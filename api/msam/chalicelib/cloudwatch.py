# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
"""
This file contains helper functions related to CloudWatch alarms.
"""

import datetime
import json
import os
import time
from urllib.parse import unquote

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from jsonpath_ng import parse

# table names generated by CloudFormation
ALARMS_TABLE_NAME = os.environ["ALARMS_TABLE_NAME"]
EVENTS_TABLE_NAME = os.environ["EVENTS_TABLE_NAME"]


def alarms_for_subscriber(resource_arn):
    """
    API entry point to return all alarms subscribed to by a node.
    """
    # split_items = []
    scanned_items = []
    try:
        resource_arn = unquote(resource_arn)
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        ddb_index_name = 'ResourceArnIndex'
        response = ddb_table.query(IndexName=ddb_index_name, KeyConditionExpression=Key('ResourceArn').eq(resource_arn))
        if "Items" in response:
            scanned_items = response["Items"]
        while "LastEvaluatedKey" in response:
            response = ddb_table.query(IndexName=ddb_index_name, KeyConditionExpression=Key('ResourceArn').eq(resource_arn), ExclusiveStartKey=response['LastEvaluatedKey'])
            if "Items" in response:
                scanned_items = scanned_items + response["Items"]
        print(scanned_items)
        for item in scanned_items:
            split_attr = item["RegionAlarmName"].split(':', maxsplit=1)
            region = split_attr[0]
            name = split_attr[1]
            item["Region"] = region
            item["AlarmName"] = name
            # alarm = {"Region": region, "AlarmName": name}
            # split_items.append(alarm)
    except ClientError as error:
        print(error)
    # return [dict(t) for t in {tuple(d.items()) for d in split_items}]
    return scanned_items


def all_subscribed_alarms():
    """
    API entry point to return a unique list of all subscribed alarms in the database.
    """
    split_items = []
    try:
        scanned_items = []
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        response = ddb_table.scan(ProjectionExpression="RegionAlarmName")
        if "Items" in response:
            scanned_items = response["Items"]
        while "LastEvaluatedKey" in response:
            response = ddb_table.scan(ProjectionExpression="RegionAlarmName", ExclusiveStartKey=response['LastEvaluatedKey'])
            if "Items" in response:
                scanned_items = scanned_items + response["Items"]
        for item in scanned_items:
            split_attr = item["RegionAlarmName"].split(':', maxsplit=1)
            region = split_attr[0]
            name = split_attr[1]
            alarm = {"Region": region, "AlarmName": name}
            split_items.append(alarm)
    except ClientError as error:
        print(error)
    return [dict(t) for t in {tuple(d.items()) for d in split_items}]


def filtered_alarm(alarm):
    """
    Restructure a CloudWatch alarm into a simpler form.
    """
    arn = [match.value for match in parse('$..AlarmArn').find(alarm)]
    name = [match.value for match in parse('$..AlarmName').find(alarm)]
    metric = [match.value for match in parse('$..MetricName').find(alarm)]
    namespace = [match.value for match in parse('$..Namespace').find(alarm)]
    state = [match.value for match in parse('$..StateValue').find(alarm)]
    updated = [match.value for match in parse('$..StateUpdatedTimestamp').find(alarm)]
    filtered = {
        "AlarmArn": arn[0] if arn else None,
        "AlarmName": name[0] if name else None,
        "MetricName": metric[0] if metric else None,
        "Namespace": namespace[0] if namespace else None,
        "StateValue": state[0] if state else None,
        "StateUpdated": int(updated[0].timestamp()) if updated else None
    }
    print(filtered)
    return filtered


def get_cloudwatch_alarms_region(region):
    """
    API entry point to retrieve all CloudWatch alarms for a given region.
    """
    alarms = []
    try:
        region = unquote(region)
        client = boto3.client('cloudwatch', region_name=region)
        response = client.describe_alarms()
        # return the response or an empty object
        if "MetricAlarms" in response:
            for alarm in response["MetricAlarms"]:
                # print(json.dumps(alarm, default=str))
                alarms.append(filtered_alarm(alarm))
        while "NextToken" in response:
            response = client.describe_alarms(NextToken=response["NextToken"])
            # return the response or an empty object
            if "MetricAlarms" in response:
                for alarm in response["MetricAlarms"]:
                    # print(json.dumps(alarm, default=str))
                    alarms.append(filtered_alarm(alarm))
    except ClientError as error:
        print(error)
    return alarms


def get_cloudwatch_events_state(state):
    """
    API entry point to retrieve all pipeline events in a given state (set, clear).
    """
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(EVENTS_TABLE_NAME)
    response = table.query(IndexName='AlarmStateIndex', KeyConditionExpression=Key('alarm_state').eq(state))
    if "Items" in response:
        alarms = response["Items"]
    else:
        alarms = []
    return alarms


def incoming_cloudwatch_alarm(event, _):
    """
    Standard AWS Lambda entry point for receiving CloudWatch alarm notifications.
    """
    print(event)
    try:
        updated_timestamp = int(time.time())
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        for record in event["Records"]:
            region = (record["Sns"]["TopicArn"]).split(":")[3]
            alarm = json.loads(record["Sns"]["Message"])
            alarm_name = [match.value for match in parse('$..AlarmName').find(alarm)]
            # look up the resources with this region alarm name
            metric = [match.value for match in parse('$..MetricName').find(alarm)]
            namespace = [match.value for match in parse('$..Namespace').find(alarm)]
            state = [match.value for match in parse('$..NewStateValue').find(alarm)]
            updated = [match.value for match in parse('$..StateChangeTime').find(alarm)]
            region_alarm_name = "{}:{}".format(region, alarm_name[0] if alarm_name else None)
            subscribers = subscribers_to_alarm(alarm_name[0] if alarm_name else None, region)
            for resource_arn in subscribers:
                item = {
                    "RegionAlarmName": region_alarm_name,
                    "ResourceArn": resource_arn,
                    "Namespace": namespace[0] if namespace else None,
                    "StateUpdated": int(datetime.datetime.strptime(updated[0], '%Y-%m-%dT%H:%M:%S.%f%z').timestamp()) if updated else None,
                    "StateValue": state[0] if state else None,
                    "Updated": updated_timestamp
                }
                ddb_table.put_item(Item=item)
                print("{} updated via alarm notification".format(resource_arn))
    except ClientError as error:
        print(error)
    return True


def subscribe_resource_to_alarm(request, alarm_name, region):
    """
    API entry point to subscribe one or more nodes to a CloudWatch alarm in a region.
    """
    try:
        alarm_name = unquote(alarm_name)
        region = unquote(region)
        region_alarm_name = "{}:{}".format(region, alarm_name)
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        resources = request.json_body
        for resource_arn in resources:
            print(resource_arn)
            # store it
            item = {"RegionAlarmName": region_alarm_name, "ResourceArn": resource_arn}
            ddb_table.put_item(Item=item)
        return True
    except ClientError as error:
        print(error)
        return False


def subscribed_with_state(alarm_state):
    """
    API entry point to return nodes subscribed to alarms in a given alarm state (OK, ALARM, INSUFFICIENT_DATA).
    """
    resources = {}
    try:
        alarm_state = unquote(alarm_state)
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        response = ddb_table.query(IndexName='StateValueIndex', KeyConditionExpression=Key('StateValue').eq(alarm_state))
        for item in response["Items"]:
            # store it
            if item["ResourceArn"] in resources:
                entry = resources[item["ResourceArn"]]
                entry["AlarmCount"] = entry["AlarmCount"] + 1
            else:
                entry = {"ResourceArn": item["ResourceArn"], "AlarmCount": 1}
            resources[item["ResourceArn"]] = entry
        while "LastEvaluatedKey" in response:
            response = ddb_table.query(IndexName='StateValueIndex', KeyConditionExpression=Key('StateValue').eq(alarm_state), ExclusiveStartKey=response['LastEvaluatedKey'])
            for item in response["Items"]:
                # store it
                if item["ResourceArn"] in resources:
                    entry = resources[item["ResourceArn"]]
                    entry["AlarmCount"] = entry["AlarmCount"] + 1
                else:
                    entry = {"ResourceArn": item["ResourceArn"], "AlarmCount": 1}
                resources[item["ResourceArn"]] = entry
    except ClientError as error:
        print(error)
    return list(resources.values())


def subscribers_to_alarm(alarm_name, region):
    """
    API entry point to return subscribed nodes of a CloudWatch alarm in a region.
    """
    subscribers = set()
    try:
        alarm_name = unquote(alarm_name)
        region = unquote(region)
        region_alarm_name = "{}:{}".format(region, alarm_name)
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        ddb_index_name = 'RegionAlarmNameIndex'
        response = ddb_table.query(IndexName=ddb_index_name, KeyConditionExpression=Key('RegionAlarmName').eq(region_alarm_name))
        for item in response["Items"]:
            subscribers.add(item["ResourceArn"])
        while "LastEvaluatedKey" in response:
            response = ddb_table.query(IndexName=ddb_index_name, KeyConditionExpression=Key('RegionAlarmName').eq(region_alarm_name), ExclusiveStartKey=response['LastEvaluatedKey'])
            for item in response["Items"]:
                subscribers.add(item["ResourceArn"])
    except ClientError as error:
        print(error)
    return sorted(subscribers)


def unsubscribe_resource_from_alarm(request, alarm_name, region):
    """
    API entry point to subscribe one or more nodes to a CloudWatch alarm in a region.
    """
    try:
        alarm_name = unquote(alarm_name)
        region = unquote(region)
        region_alarm_name = "{}:{}".format(region, alarm_name)
        ddb_table_name = ALARMS_TABLE_NAME
        ddb_resource = boto3.resource('dynamodb')
        ddb_table = ddb_resource.Table(ddb_table_name)
        resources = request.json_body
        for resource_arn in resources:
            # store it
            item = {"RegionAlarmName": region_alarm_name, "ResourceArn": resource_arn}
            # delete it
            ddb_table.delete_item(Key=item)
        return True
    except ClientError as error:
        print(error)
        return False
