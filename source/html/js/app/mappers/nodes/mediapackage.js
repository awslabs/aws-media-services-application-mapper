/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "app/server", "app/connections", "app/regions", "app/model", "app/ui/svg_node"],
    function($, server, connections, region_promise, model, svg_node) {

        const update_channels = function() {
            const local_svg_node = svg_node;
            const current = connections.get_current();
            const url = current[0];
            const api_key = current[1];
            const nodes = model.nodes;
            const node_type = "MediaPackage Channel";
            const rgb = "#007DBC";
            return new Promise((resolve, reject) => {
                server.get(url + "/cached/mediapackage-channel", api_key).then((channels) => {
                    for (let cache_entry of channels) {
                        const channel = JSON.parse(cache_entry.data);
                        const name = channel.Id;
                        const id = channel.Arn;
                        let node_data = {
                            "cache_update": cache_entry.updated,
                            "id": channel.Arn,
                            "region": cache_entry.region,
                            "shape": "image",
                            "image": {
                                "unselected": null,
                                "selected": null
                            },
                            "header": "<b>MediaPackage Channel:</b> " + channel.Id,
                            "data": channel,
                            "title": "MediaPackage Channel",
                            "name": name,
                            "size": 55,
                            "render": {
                                normal_unselected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_rgb = rgb;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.unselected(local_node_type, local_name, local_rgb, local_id);
                                    };
                                })(),
                                normal_selected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_rgb = rgb;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.selected(local_node_type, local_name, local_rgb, local_id);
                                    };
                                })(),
                                alert_unselected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.unselected(local_node_type, local_name, "#ff0000", local_id);
                                    };
                                })(),
                                alert_selected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.selected(local_node_type, local_name, "#ff0000", local_id);
                                    };
                                })()
                            },
                            "console_link": (function() {
                                let id = channel.Id;
                                let region = channel.Arn.split(":")[3];
                                return function() {
                                    let html = `https://console.aws.amazon.com/mediapackage/home?region=${region}#/channels/${id}`;
                                    return html;
                                };
                            })(),
                            "cloudwatch_link": (function() {
                                let id = channel.Id;
                                let region = channel.Arn.split(":")[3];
                                return function() {
                                    let html = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#metricsV2:graph=~();search=${id};namespace=AWS/MediaPackage;dimensions=Channel`;
                                    return html;
                                };
                            })()
                        };
                        node_data.image.selected = node_data.render.normal_selected();
                        node_data.image.unselected = node_data.render.normal_unselected();
                        nodes.update(node_data);
                    }
                    resolve();
                }).catch(function(error) {
                    console.log(error);
                    reject(error);
                });
            });
        };

        const update_endpoints = function() {
            const local_svg_node = svg_node;
            const current = connections.get_current();
            const url = current[0];
            const api_key = current[1];
            const nodes = model.nodes;
            const node_type = "MediaPackage Endpoint";
            const rgb = "#00A1C9";
            return new Promise((resolve, reject) => {
                server.get(url + "/cached/mediapackage-origin-endpoint", api_key).then((origin_endpoints) => {
                    for (let cache_entry of origin_endpoints) {
                        const endpoint = JSON.parse(cache_entry.data);
                        const name = endpoint.Id;
                        const id = endpoint.Arn;
                        let node_data = {
                            "cache_update": cache_entry.updated,
                            "id": id,
                            "region": cache_entry.region,
                            "shape": "image",
                            "image": {
                                "unselected": null,
                                "selected": null
                            },
                            "header": "<b>MediaPackage Endpoint:</b> " + endpoint.Id,
                            "data": endpoint,
                            "title": node_type,
                            "name": name,
                            "size": 55,
                            "render": {
                                normal_unselected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_rgb = rgb;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.unselected(local_node_type, local_name, local_rgb, local_id);
                                    };
                                })(),
                                normal_selected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_rgb = rgb;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.selected(local_node_type, local_name, local_rgb, local_id);
                                    };
                                })(),
                                alert_unselected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.unselected(local_node_type, local_name, "#ff0000", local_id);
                                    };
                                })(),
                                alert_selected: (function() {
                                    let local_node_type = node_type;
                                    let local_name = name;
                                    let local_id = id;
                                    return function() {
                                        return local_svg_node.selected(local_node_type, local_name, "#ff0000", local_id);
                                    };
                                })()
                            },
                            "console_link": (function() {
                                let id = endpoint.Id;
                                let parent_id = endpoint.ChannelId;
                                let region = endpoint.Arn.split(":")[3];
                                return function() {
                                    let html = `https://console.aws.amazon.com/mediapackage/home?region=${region}#/channels/${parent_id}/endpoints/${id}`;
                                    return html;
                                };
                            })(),
                            "cloudwatch_link": (function() {
                                let id = endpoint.Id;
                                let region = endpoint.Arn.split(":")[3];
                                return function() {
                                    let html = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#metricsV2:graph=~();search=${id};namespace=AWS/MediaPackage;dimensions=Channel,OriginEndpoint`;
                                    return html;
                                };
                            })()
                        };
                        node_data.image.selected = node_data.render.normal_selected();
                        node_data.image.unselected = node_data.render.normal_unselected();
                        nodes.update(node_data);
                    }
                    resolve();
                }).catch(function(error) {
                    console.log(error);
                    reject(error);
                });
            });
        };

        const update = function() {
            return Promise.all([update_channels(), update_endpoints()]);
        };

        return {
            "name": "MediaPackage Channels and Endpoints",
            "update": update
        };
    });