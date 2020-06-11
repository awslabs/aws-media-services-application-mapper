# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
"""
This file contains helper functions for building the node cache.
"""

import hashlib
import json
import os
import time
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from botocore.exceptions import EndpointConnectionError
from jsonpath_ng import parse

from chalicelib import content
from chalicelib import cache

# TTL provided via CloudFormation
CACHE_ITEM_TTL = int(os.environ["CACHE_ITEM_TTL"])

STAMP = os.environ["BUILD_STAMP"]
# used to handle throttling, be very patient and back off a lot if needed
MSAM_BOTO3_CONFIG = Config(retries={'max_attempts': 15}, user_agent="aws-media-services-applications-mapper/{stamp}/nodes.py".format(stamp=STAMP))

def update_regional_ddb_items(region_name):
    """
    Update all services in the cache for a region.
    """
    try:
        print("medialive-input")
        content.put_ddb_items(medialive_input_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("medialive-channel")
        content.put_ddb_items(medialive_channel_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("medialive-multiplex")
        content.put_ddb_items(medialive_multiplex_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("mediapackage-channel")
        content.put_ddb_items(mediapackage_channel_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("mediapackage-origin-endpoint")
        content.put_ddb_items(mediapackage_origin_endpoint_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("mediastore-container")
        content.put_ddb_items(mediastore_container_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("speke-server")
        content.put_ddb_items(speke_server_ddb_items(region_name))
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("mediaconnect-flow")
        content.put_ddb_items(mediaconnect_flow_ddb_items(region_name))
    except ClientError as error:
        print(error)
    try:
        print("mediatailor-configuration")
        content.put_ddb_items(mediatailor_configuration_ddb_items(region_name))
    except ClientError as error:
        print(error)
    try:
        print("ec2-instances")
        content.put_ddb_items(ec2_instance_ddb_items(region_name))
    except ClientError as error:
        print(error)


def update_regional_ssm_ddb_items(region_name):
    """
    Update ssm nodes in the cache for a region.
    """
    try:
        print("ssm-managed-instances")
        content.put_ddb_items(ssm_managed_instance_ddb_items(region_name))
    except ClientError as error:
        print(error)


def update_global_ddb_items():
    """
    Update all global services in the cache.
    """
    try:
        print("s3-bucket")
        content.put_ddb_items(s3_bucket_ddb_items())
    except (ClientError, EndpointConnectionError) as error:
        print(error)
    try:
        print("cloudfront-distribution")
        content.put_ddb_items(cloudfront_distribution_ddb_items())
    except (ClientError, EndpointConnectionError) as error:
        print(error)


def s3_bucket_ddb_items():
    """
    Retrieve and format S3 buckets for cache storage.
    """
    items = []
    for bucket in s3_buckets():
        arn = "arn:aws:s3:::{}".format(bucket["Name"])
        service = "s3"
        items.append(node_to_ddb_item(arn, service, "global", bucket))
    return items


def cloudfront_distribution_ddb_items():
    """
    Retrieve and format CloudFront distributions for cache storage.
    """
    items = []
    for item in cloudfront_distributions():
        arn = item["ARN"]
        service = "cloudfront-distribution"
        item['idle_state'] = bool(False)
        if 'Status' in item:
            item['idle_state'] = bool(item['Status'] != 'Deployed')
        items.append(node_to_ddb_item(arn, service, "global", item))
    return items


def medialive_channel_ddb_items(region):
    """
    Retrieve and format MediaLive channels for cache storage.
    """
    items = []
    for channel in medialive_channels(region):
        arn = channel["Arn"]
        service = "medialive-channel"
        channel['idle_state'] = bool(False)
        if 'State' in channel:
            channel['idle_state'] = bool(channel['State'] != 'RUNNING')
        items.append(node_to_ddb_item(arn, service, region, channel))
    return items


def medialive_input_ddb_items(region):
    """
    Retrieve and format MediaLive inputs for cache storage.
    """
    items = []
    for ml_input in medialive_inputs(region):
        arn = ml_input["Arn"]
        service = "medialive-input"
        ml_input['idle_state'] = bool(False)
        if 'State' in ml_input:
            ml_input['idle_state'] = bool(ml_input['State'] != 'ATTACHED')
        items.append(node_to_ddb_item(arn, service, region, ml_input))
    return items


def medialive_multiplex_ddb_items(region):
    """
    Retrieve and format MediaLive inputs for cache storage.
    """
    items = []
    for multiplex in medialive_multiplexes(region):
        arn = multiplex["Arn"]
        service = "medialive-multiplex"
        multiplex['idle_state'] = bool(False)
        if 'State' in multiplex:
            multiplex['idle_state'] = bool(multiplex['State'] != 'RUNNING')
        items.append(node_to_ddb_item(arn, service, region, multiplex))
    return items


def mediapackage_channel_ddb_items(region):
    """
    Retrieve and format MediaPackage channels for cache storage.
    """
    items = []
    for channel in mediapackage_channels(region):
        arn = channel["Arn"]
        service = "mediapackage-channel"
        items.append(node_to_ddb_item(arn, service, region, channel))
    return items


def mediapackage_origin_endpoint_ddb_items(region):
    """
    Retrieve and format MediaPackage endpoints for cache storage.
    """
    items = []
    for endpoint in mediapackage_origin_endpoints(region):
        arn = endpoint["Arn"]
        service = "mediapackage-origin-endpoint"
        items.append(node_to_ddb_item(arn, service, region, endpoint))
    return items


def mediastore_container_ddb_items(region):
    """
    Retrieve and format MediaPackage endpoints for cache storage.
    """
    items = []
    for container in mediastore_containers(region):
        arn = container["ARN"]
        service = "mediastore-container"
        items.append(node_to_ddb_item(arn, service, region, container))
    return items


def speke_server_ddb_items(region):
    """
    Find the SPEKE key servers based on MediaPackage endpoint configurations
    """
    items = []
    # create an expression to find speke server urls
    jsonpath_expr = parse('$..SpekeKeyProvider.Url')
    # get MediaPackage origin endpoints
    mediapackage_ep_cached = cache.cached_by_service_region("mediapackage-origin-endpoint", region)
    for endpoint in mediapackage_ep_cached:
        # decode the endpoint configuration
        endpoint_data = json.loads(endpoint["data"])
        for server_url in [match.value for match in jsonpath_expr.find(endpoint_data)]:
            parsed = urlparse(server_url)
            sha = hashlib.sha1()
            sha.update(server_url.encode('utf-8'))
            url_digest = sha.hexdigest()
            arn = "arn:oss:speke:::{}".format(url_digest)
            config = {"arn": arn, "endpoint": server_url, "scheme": parsed.scheme}
            service = "speke-keyserver"
            # print(config)
            items.append(node_to_ddb_item(arn, service, "global", config))
    return items


def mediaconnect_flow_ddb_items(region):
    """
    Retrieve and format MediaConnect flows for cache storage.
    """
    items = []
    for mc_flow in mediaconnect_flows(region):
        arn = mc_flow["FlowArn"]
        service = "mediaconnect-flow"
        mc_flow['idle_state'] = bool(False)
        if 'Status' in mc_flow:
            mc_flow['idle_state'] = bool(mc_flow['Status'] != 'ACTIVE')
        items.append(node_to_ddb_item(arn, service, region, mc_flow))
    return items


def mediatailor_configuration_ddb_items(region):
    """
    Retrieve and format MediaTailor configuration for cache storage.
    """
    items = []
    for config in mediatailor_configurations(region):
        arn = config["PlaybackConfigurationArn"]
        service = "mediatailor-configuration"
        items.append(node_to_ddb_item(arn, service, region, config))
    return items


def ssm_managed_instance_ddb_items(region):
    """
    Retrieve and format SSM managed instances for cache storage.
    """
    items = []
    for managed_instance in ssm_managed_instances(region):
        account_id = boto3.client('sts').get_caller_identity().get('Account')
        arn = "arn:aws:ssm-managed-instance:" + region + ":" + account_id + ":instance/" + managed_instance['Id']
        service = "ssm-managed-instance"
        items.append(node_to_ddb_item(arn, service, region, managed_instance))
    return items


def ec2_instance_ddb_items(region):
    """
    Retrieve and format EC2 instances for cache storage.
    """
    items = []
    for ec2_instance in ec2_instances(region):
        arn = "arn:aws:ec2-instance:" + region + "::" + ec2_instance['InstanceId']
        service = "ec2-instance"
        ec2_instance['idle_state'] = bool(False)
        if 'State' in ec2_instance and 'Name' in ec2_instance['State']:
            ec2_instance['idle_state'] = bool(ec2_instance['State']['Name'] != 'running')
        items.append(node_to_ddb_item(arn, service, region, ec2_instance))
    return items


def node_to_ddb_item(arn, service, region, config):
    """
    Restructure an item from a List or Describe API call into a cache item.
    """
    now = int(time.time())
    item = {"arn": arn, "region": region, "service": service, "updated": now, "expires": now + CACHE_ITEM_TTL, "data": json.dumps(config, default=str)}
    return item


def cloudfront_distributions():
    """
    Retrieve all CloudFront distributions (global).
    Tags retrieved.
    """
    service = boto3.client("cloudfront", config=MSAM_BOTO3_CONFIG)
    response = service.list_distributions()
    items = response["DistributionList"]["Items"]
    while "NextMarker" in response["DistributionList"]:
        response = service.list_distributions(Marker=response["DistributionList"]["NextMarker"])
        items = items + response["DistributionList"]["Items"]
    for item in items:
        item['LastModifiedTime'] = str(item['LastModifiedTime'])
        try:
            response = service.list_tags_for_resource(Resource=item["ARN"])
            item["Tags"] = {}
            if "Items" in response["Tags"]:
                for tag in response["Tags"]["Items"]:
                    item["Tags"][tag["Key"]] = tag["Value"]
        except ClientError as error:
            print(error)
    return items


def s3_buckets():
    """
    Retrieve all S3 buckets (global).
    """
    service = boto3.client("s3", config=MSAM_BOTO3_CONFIG)
    buckets = service.list_buckets()
    for item in buckets["Buckets"]:
        item["CreationDate"] = str(item["CreationDate"])
        try:
            response = service.get_bucket_tagging(Bucket=item["Name"])
            item["Tags"] = {}
            if "TagSet" in response:
                for tag in response["TagSet"]:
                    item["Tags"][tag["Key"]] = tag["Value"]
        except ClientError:
            pass
    return buckets["Buckets"]


def mediapackage_channels(region):
    """
    Return the MediaPackage channels for the given region.
    Tags included.
    """
    items = []
    service_name = 'mediapackage'
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        jsonpath_expr = parse('$..Password')
        response = service.list_channels()
        items = items + response['Channels']
        while "NextToken" in response:
            response = service.list_channels(NextToken=response["NextToken"])
            items = items + response['Channels']
        jsonpath_expr.update(items, "XXXXXXXXXXXX")
    else:
        print("not available in this region")
    return items


def mediapackage_origin_endpoints(region):
    """
    Return the MediaPackage origin endpoints for the given region.
    Tags included.
    """
    items = []
    service_name = 'mediapackage'
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.list_origin_endpoints()
        items = items + response['OriginEndpoints']
        while "NextToken" in response:
            response = service.list_origin_endpoints(NextToken=response["NextToken"])
            items = items + response['OriginEndpoints']
    else:
        print("not available in this region")
    return items


def medialive_channels(region):
    """
    Return the MediaLive channels for the given region.
    Tags included.
    """
    items = []
    service_name = "medialive"
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.list_channels()
        items = items + response['Channels']
        while "NextToken" in response:
            response = service.list_channels(NextToken=response["NextToken"])
            items = items + response['Channels']
    else:
        print("not available in this region")
    return items


def medialive_inputs(region):
    """
    Return the MediaLive inputs for the given region.
    Tags included.
    """
    items = []
    service_name = "medialive"
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.list_inputs()
        items = items + response['Inputs']
        while "NextToken" in response:
            response = service.list_inputs(NextToken=response["NextToken"])
            items = items + response['Inputs']
    else:
        print("not available in this region")
    return items


def medialive_multiplexes(region):
    """
    Return the MediaLive Multiplexes for the given region.
    Tags included.
    """
    items = []
    service_name = "medialive"
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        lm_response = service.list_multiplexes()
        for multiplex in lm_response["Multiplexes"]:
            multiplex_id = multiplex["Id"]
            plex_response = service.describe_multiplex(MultiplexId=multiplex_id)
            del plex_response['ResponseMetadata']
            items.append(plex_response)
        while "NextToken" in lm_response:
            lm_response = service.list_multiplexes(NextToken=lm_response["NextToken"])
            for multiplex in lm_response["Multiplexes"]:
                multiplex_id = multiplex["Id"]
                plex_response = service.describe_multiplex(MultiplexId=multiplex_id)
                del plex_response['ResponseMetadata']
                items.append(plex_response)
    else:
        print("not available in this region")
    return items


def mediastore_containers(region):
    """
    Return the MediaLive inputs for the given region.
    NO TAGS
    """
    items = []
    service_name = "mediastore"
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.list_containers()
        items = items + response['Containers']
        while "NextToken" in response:
            response = service.list_containers(NextToken=response["NextToken"])
            items = items + response['Containers']
        for item in items:
            item['CreationTime'] = str(item['CreationTime'])
    else:
        print("not available in this region")
    return items


def mediaconnect_flows(region):
    """
    Return the MediaConnect flows for the given region.
    NO TAGS
    """
    items = []
    service_name = 'mediaconnect'
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.list_flows()
        flows = response['Flows']
        while "NextToken" in response:
            response = service.list_flows(NextToken=response["NextToken"])
            flows = flows + response['Flows']
        for flow in flows:
            try:
                flow_details = service.describe_flow(FlowArn=flow['FlowArn'])
                response = service.list_tags_for_resource(ResourceArn=flow["FlowArn"])
                flow_details["Tags"] = response["Tags"]
            except ClientError as error:
                print(error)
            items.append(flow_details['Flow'])
    else:
        print("not available in this region")
    return items


def mediatailor_configurations(region):
    """
    Return the MediaTailor configurations for the given region.
    Tags included.
    """
    items = []
    service_name = 'mediatailor'
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.list_playback_configurations()
        configs = response['Items']
        while "NextToken" in response:
            response = service.list_playback_configurations(NextToken=response["NextToken"])
            configs = configs + response['Items']
        for config in configs:
            response = service.get_playback_configuration(Name=config['Name'])
            if 'ResponseMetadata' in response:
                del response['ResponseMetadata']
            items.append(response)
    else:
        print("not available in this region")
    return items


def ssm_managed_instances(region):
    """
    Retrieve resources like on-prem encoders stored in SSM with MSAM specific tags.
    """
    items = []
    devices = []
    service_name = 'ssm'
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.get_inventory(Filters=[
                {
                    'Key': 'AWS:InstanceInformation.InstanceStatus',
                    'Values': [
                        'Terminated',
                    ],
                    'Type': 'NotEqual'
                }
        ])
        devices = devices + response['Entities']
        while "NextToken" in response:
            response = service.get_inventory(NextToken=response["NextToken"])
            devices = devices + response['Entities']
        for device in devices:
            #process hybrid/on prem machines
            device['Tags'] = {}
            if device['Id'].startswith('mi-'):
                device_tags = service.list_tags_for_resource(ResourceType='ManagedInstance', ResourceId=device['Id'])
                #check for MSAM-NodeType is present, then store this as a node
                if 'TagList' in device_tags:
                    for tag in device_tags['TagList']:
                        #reformat tags before adding to device data
                        device['Tags'][tag['Key']] = tag['Value']
                items.append(device)
    else:
        print("not available in this region")
    return items


def ec2_instances(region):
    """
    Retrieve EC2 instances with MSAM specific tags.
    """
    items = []
    reservations = []
    service_name = 'ec2'
    if region in boto3.Session().get_available_regions(service_name):
        service = boto3.client(service_name, region_name=region, config=MSAM_BOTO3_CONFIG)
        response = service.describe_instances()
        reservations = reservations + response['Reservations']
        while "NextToken" in response:
            response = service.describe_instances(NextToken=response["NextToken"])
            reservations = reservations + response['Reservations']
        for reservation in reservations:
            for instance in reservation['Instances']:
                if 'Tags' in instance:
                    final_tags = {}
                    for tag in instance['Tags']:
                        #reformat the tags before appending to data
                        final_tags[tag["Key"]] = tag["Value"]
                        instance['Tags'] = final_tags
                items.append(instance)
    else:
        print("not available in this region")
    return items
