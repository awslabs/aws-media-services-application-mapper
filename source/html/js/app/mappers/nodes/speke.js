/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "app/server", "app/connections", "app/model", "app/ui/svg_node"],
    function($, server, connections, model, svg_node) {

        /*
        This module technically adds a new kind of node, but it depends on the 
        MediaPackage node mapper to be complete. This module runs with the connectors 
        to be sure all MediaPackage inventory is loaded first.
        */

        const node_type = "SPEKE Keyserver";

        const update_speke_keyservers = function() {
            const local_svg_node = svg_node;
            const current = connections.get_current();
            const url = current[0];
            const api_key = current[1];
            const nodes = model.nodes;
            const rgb = "#cc00ff";
            return new Promise((resolve, reject) => {
                server.get(url + "/cached/speke-keyserver", api_key).then((speke_keyservers_cached) => {
                    for (let keyserver of speke_keyservers_cached) {
                        const keyserver_data = JSON.parse(keyserver.data);
                        const name = keyserver_data.endpoint;
                        const id = keyserver.arn;
                        let node_data = {
                            "cache_update": keyserver.updated,
                            "id": id,
                            "region": keyserver.region,
                            "shape": "image",
                            "image": {
                                "unselected": null,
                                "selected": null
                            },
                            "header": "<b>" + node_type + ":</b> " + keyserver_data.endpoint,
                            "data": keyserver_data,
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
                                return function() {
                                    let html = `https://console.aws.amazon.com/`;
                                    return html;
                                };
                            })(),
                            "cloudwatch_link": (function() {
                                return function() {
                                    let html = `https://console.aws.amazon.com/`;
                                    return html;
                                };
                            })()
                        };
                        node_data.image.selected = node_data.render.normal_selected();
                        node_data.image.unselected = node_data.render.normal_unselected();
                        nodes.update(node_data);
                    }
                    resolve();
                });
            });
        };

        const update = function() {
            return update_speke_keyservers();
        };

        return {
            "name": node_type + "s",
            "update": update
        };
    });