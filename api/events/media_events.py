# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
"""
This Lambda is responsible for receiving and storing CloudWatch events
originating from Media Services. This Lambda must be installed into
each region where Media Services are created.
"""

import datetime
import os
import json
from random import randint
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from botocore.config import Config
from jsonpath_ng import parse

# user-agent config
STAMP = os.environ["BUILD_STAMP"]
MSAM_BOTO3_CONFIG = Config(user_agent="aws-media-services-applications-mapper/{stamp}/media_events.py".format(stamp=STAMP))

DYNAMO_REGION_NAME = os.environ["EVENTS_TABLE_REGION"]
DYNAMO_RESOURCE = boto3.resource('dynamodb', region_name=DYNAMO_REGION_NAME, config=MSAM_BOTO3_CONFIG)
EVENTS_TABLE = DYNAMO_RESOURCE.Table(os.environ["EVENTS_TABLE_NAME"])
CLOUDWATCH_EVENTS_TABLE = DYNAMO_RESOURCE.Table(os.environ["CLOUDWATCH_EVENTS_TABLE_NAME"])
CONTENT_TABLE_NAME = os.environ["CONTENT_TABLE_NAME"]


def lambda_handler(event, _):
    """
    Entry point for CloudWatch event receipt.
    """
    try:
        print(event)
        event["timestamp"] = int(datetime.datetime.strptime(
            event["time"], '%Y-%m-%dT%H:%M:%SZ').timestamp())
        event["expires"] = event["timestamp"] + int(os.environ["ITEM_TTL"])
        event["detail"]["time"] = event["time"]

        # catch all the various forms of ARN from the media services
        arn_expr = parse('$..arn|aRN|resource-arn|channel_arn|multiplex_arn|flowArn|PlaybackConfigurationArn|resourceArn')
        original_arns = [match.value for match in arn_expr.find(event)]
        arns = []
        # remove arn that is for userIdentity or inputSecurityGroup
        # note: can't remove an item from a list that's being iterated over so doing it this way
        for arn in original_arns:
            if "user" in arn or "role" in arn or "inputSecurityGroup" in arn:
                pass
            else:
                arns.append(arn)
        if arns:
            event["resource_arn"] = unquote(arns[0])
        # for certain events, the ARN is not labeled as an ARN but instead put in the resources list
        if not arns and event["resources"]:
            if "vod" not in event["resources"][0]:
                event["resource_arn"] = event["resources"][0]

        # handle alerts
        if "Alert" in event["detail-type"]:
            # medialive alerts
            if "MediaLive" in event["detail-type"]:
                event["alarm_id"] = event["detail"]["alarm_id"]
                event["alarm_state"] = event["detail"]["alarm_state"].lower()
                event["detail"]["pipeline_state"] = get_pipeline_state(event)
                # maintain state
                current_state = get_current_state(event)
                for prop in current_state:
                    event["detail"][prop] = current_state[prop]
            # mediaconnect alerts
            elif "MediaConnect" in event["detail-type"]:
                event["alarm_id"] = event["detail"]["error-id"]
                if event["detail"]["errored"] == True:
                    event["alarm_state"] = "set"
                else:
                    event["alarm_state"] = "cleared"
                event["detail"]["alert_type"] = event["detail"]["error-code"]
                del event["detail"]["error-code"]
                event["detail"]["message"] = event["detail"]["error-message"]
                del event["detail"]["error-message"]
            #print(event)
            EVENTS_TABLE.put_item(Item=event)
            print(event["detail-type"] + " stored.")
        
        # set the rest of the information needed for storing as regular CWE
        # give timestamp a millisecond precision since it's sort key in CWE table
        event["timestamp"] = event["timestamp"] * 1000 + randint(1, 999)
        event["data"] = json.dumps(event["detail"])
        event["type"] = event["detail-type"]
        if "eventName" in event["detail"]:
            event["type"] = event["type"] + ": " + event["detail"]["eventName"]

        # handle specific cases depending on source
        if event["source"] == "aws.medialive":
            if "BatchUpdateSchedule" in event["type"]:
                    print("Creating an ARN for BatchUpdateSchedule event.")
                    event["resource_arn"] = "arn:aws:medialive:" + event['region'] + ":" + \
                        event['account'] + ":channel:" + \
                        event['detail']['requestParameters']['channelId']
        elif event["source"] == "aws.mediapackage":
            if "HarvestJob" in event["type"]:
                print("Asking MediaPackage for the ARN of endpoint in a HarvestJob event.")
                # to get the ARN, ask mediapackage to describe the origin endpoint
                # the ARN available through resources is the HarvestJob ARN, not the endpoint
                orig_id_expr = parse('$..origin_endpoint_id')
                orig_id = [match.value for match in orig_id_expr.find(event)]
                if orig_id:
                    emp_client = boto3.client('mediapackage')
                    response = emp_client.describe_origin_endpoint(
                        Id=orig_id[0])
                    event["resource_arn"] = response["Arn"]
                else:
                    print("Skipping this event. Origin ID not present in the HarvestJob event." + event["type"])
        elif event["source"] == "aws.mediastore":
            # for object state change the resource is the object, not the container 
            # so the captured arn needs to be fixed
            if "MediaStore Object State Change" in event["type"]:
                temp_arn = event["resource_arn"].split('/')
                event["resource_arn"] = temp_arn[0] + "/" + temp_arn[1]
        
        # if item has no resource arn, don't save in DB
        if "resource_arn" in event:
            #print(event)
            print("Storing media service event.")
            CLOUDWATCH_EVENTS_TABLE.put_item(Item=event)
        else:
            print("Skipping this event. " + event["type"])
    except ClientError as error:
        print(error)
    return True


def get_pipeline_state(event):
    """
    Check for pipeline state only if source is aws.medialive
    """
    arn = event["resource_arn"]
    running_pipeline = bool(True)
    try:
        if event["source"] == "aws.medialive":
            if "alarm_state" in event["detail"] and event["detail"]["alarm_state"] == "SET":
                item = get_content_record(arn)
                if "service" in item and item["service"] == "medialive-multiplex":
                    running_pipeline = bool(False)
                else:
                    data = json.loads(item["data"])
                    if "ChannelClass" in data and data["ChannelClass"] == "STANDARD":
                        running_pipeline = bool(False)
            elif "state" in event["detail"] and event["detail"]["state"] == "STOPPING":
                running_pipeline = bool(False)
    except ClientError as error:
        print(error)
    if "pipeline" in event["detail"]:
        log_msg = 'Pipeline {} state to for {} is {}'
        print(log_msg.format(event["detail"]["pipeline"], arn, running_pipeline))
    return running_pipeline


def get_current_state(event):
    """
    Retrieve state and update according to current event. 
    Flag the details if stopping or stopped
    """
    current_state = {}
    try:
        if event["source"] == "aws.medialive":
            new_state = str("N/A")
            old_state = str("N/A")
            current_state["idle"] = bool(False)
            item = get_content_record(event["resource_arn"])
            data = json.loads(item["data"])
            if "State" in data:
                old_state = data["State"]
            if "state" in event["detail"]:
                new_state = event["detail"]["state"]
            elif "alarm_state" in event["detail"]:
                new_state = event["detail"]["alarm_state"]

            print("Incoming event state => " + new_state)
            print("Old event state => " + old_state)
            
            # update the idle state
            if new_state is not None:
                if not data["idle_state"]:
                    data["idle_state"] = bool(new_state == "STOPPED")
                elif data["idle_state"]:
                    data["idle_state"] = bool(new_state == "STARTING" or new_state == "RUNNING")
                current_state["idle_state"] = data["idle_state"]

            # update the State
            if old_state is not None:
                if new_state != old_state:
                    data["State"] = new_state
                current_state["State"] = data["State"]
            if old_state != "STOPPED":
                current_state["idle"] = bool(new_state == "STOPPED")
            else:
                current_state["idle"] = bool(new_state == "STARTING" or new_state == "RUNNING")
            item["data"] = json.dumps(data)
            # update the content record with the new current_state
            update_content_record(item)
    except ClientError as error:
        print(error)
    return current_state


def get_content_record(arn):
    """
    Get the content record from dynamo, given the arn
    """
    record = None
    try:
        resource = boto3.resource('dynamodb', region_name=DYNAMO_REGION_NAME)
        CONTENT_TABLE = resource.Table(CONTENT_TABLE_NAME)
        response = CONTENT_TABLE.query(KeyConditionExpression=Key('arn').eq(arn))
        if "Items" in response:
            record = response["Items"][0]
    except ClientError as error:
        print(error)
    return record


def update_content_record(item):
    """
    Update the content record to dynamo, given the arn
    """
    try:
        resource = boto3.resource('dynamodb', region_name=DYNAMO_REGION_NAME)
        CONTENT_TABLE = resource.Table(CONTENT_TABLE_NAME)
        CONTENT_TABLE.put_item(Item=item)
        print("Updated content record for " + item["arn"])
    except ClientError as error:
        print(error)
