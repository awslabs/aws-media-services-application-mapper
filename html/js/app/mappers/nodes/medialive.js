/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "app/server", "app/connections", "app/regions", "app/model", "app/ui/svg_node"], 
    function($, server, connections, region_promise, model, svg_node) {

        const node_map_handler = (node_type, name, rgb, id, selected, data) => {
            const local_id = id;
            const local_rgb = rgb;
            const local_name = name;
            const local_node_type = node_type;
            const method = selected ? 'selected' : 'unselected';
            return () => svg_node[method](local_node_type, local_name, local_rgb, local_id, data);
        };

        var update_channels = function(regionName) {
            var current = connections.get_current();
            var url = current[0];
            var api_key = current[1];
            return new Promise(function(resolve, reject) {
                server.get(`${url}/cached/medialive-channel/${regionName}`, api_key).then(function(channels) {
                    for (let cache_entry of channels) {
                        map_channel(cache_entry);
                    }
                    resolve();
                }).catch(function(error) {
                    console.log(error);
                    reject(error);
                });
            });
        };

        var update_inputs = function(regionName) {
            var current = connections.get_current();
            var url = current[0];
            var api_key = current[1];
            return new Promise((resolve, reject) => {
                server.get(`${url}/cached/medialive-input/${regionName}`, api_key).then((inputs) => {
                    for (let cache_entry of inputs) {
                        map_input(cache_entry);
                    }
                    resolve();
                }).catch(function(error) {
                    console.log(error);
                    reject(error);
                });
            });
        };

        var update_multiplexes = function(regionName) {
            var current = connections.get_current();
            var url = current[0];
            var api_key = current[1];
            return new Promise((resolve, reject) => {
                server.get(`${url}/cached/medialive-multiplex/${regionName}`, api_key).then((inputs) => {
                    for (let cache_entry of inputs) {
                        map_multiplex(cache_entry);
                    }
                    resolve();
                }).catch(function(error) {
                    console.log(error);
                    reject(error);
                });
            });
        };

        var map_channel = function(cache_entry) {
            var channel = JSON.parse(cache_entry.data);

            // console.log('Channel: %o', channel);

            var name = channel.Name;
            var id = channel.Arn;
            var nodes = model.nodes;
            var rgb = "#1E8900";
            var idle_rgb = svg_node.getIdleRgb();
            var degraded_rgb = svg_node.getDegradedRgb();
            var node_type = "MediaLive Channel";
            var node_data = {
                cache_update: cache_entry.updated,
                id: id,
                region: cache_entry.region,
                shape: "image",
                image: {
                    unselected: null,
                    selected: null
                },
                header: `<b>${node_type}:</b> ${name}`,
                data: channel,
                title: node_type,
                name: name,
                size: 55,
                render: {
                    normal_unselected: (() => node_map_handler(node_type, name, rgb, id, false, channel))(),
                    normal_selected: (() => node_map_handler(node_type, name, rgb, id, true, channel))(),
                    alert_unselected: (() => node_map_handler(node_type, name, "#ff0000", id, false, channel))(),
                    alert_selected: (() => node_map_handler(node_type, name, "#ff0000", id, true, channel))(),
                    degraded_unselected: (() => node_map_handler(node_type, name, degraded_rgb, id, false, channel))(),
                    degraded_selected: (() => node_map_handler(node_type, name, degraded_rgb, id, true, channel))(),
                    idle_unselected: (() => node_map_handler(node_type, name, idle_rgb, id, false, channel))(),
                    idle_selected: (() => node_map_handler(node_type, name, idle_rgb, id, true, channel))(),
                },
                console_link: (function() {
                    var id = channel.Id;
                    var region = channel.Arn.split(":")[3];
                    return function() {
                        var html = `https://console.aws.amazon.com/medialive/home?region=${region}#/channels/${id}`;
                        return html;
                    };
                })(),
                cloudwatch_link: (function() {
                    var id = channel.Id;
                    var region = channel.Arn.split(":")[3];
                    return function() {
                        var html = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#metricsV2:graph=~();search=${id};namespace=MediaLive;dimensions=ChannelId,Pipeline`;
                        return html;
                    };
                })()
            };

            if (channel.idle_state) {
                node_data.image.selected = node_data.render.idle_selected();
                node_data.image.unselected = node_data.render.idle_unselected();    
            } else {
                node_data.image.selected = node_data.render.normal_selected();
                node_data.image.unselected = node_data.render.normal_unselected();
            }
            
            nodes.update(node_data);
        };

        var map_input = function(cache_entry) {
            var input = JSON.parse(cache_entry.data);

            // console.log('Input: %o', input);

            var name = input.Name;
            var id = input.Arn;
            var nodes = model.nodes;
            var node_type = "MediaLive Input";
            var rgb = "#6AAF35";
            var idle_rgb = svg_node.getIdleRgb();
            var degraded_rgb = svg_node.getDegradedRgb();
            var node_data = {
                cache_update: cache_entry.updated,
                id: input.Arn,
                region: cache_entry.region,
                shape: "image",
                image: {
                    unselected: null,
                    selected: null
                },
                header: `<b>${node_type}:</b> ${name}`,
                data: input,
                title: node_type,
                name: name,
                size: 55,
                render: {
                    normal_unselected: (() => node_map_handler(node_type, name, rgb, id, false, input))(),
                    normal_selected: (() => node_map_handler(node_type, name, rgb, id, true, input))(),
                    alert_unselected: (() => node_map_handler(node_type, name, "#ff0000", id, false, input))(),
                    alert_selected: (() => node_map_handler(node_type, name, "#ff0000", id, true, input))(),
                    degraded_unselected: (() => node_map_handler(node_type, name, degraded_rgb, id, false, input))(),
                    degraded_selected: (() => node_map_handler(node_type, name, degraded_rgb, id, true, input))(),
                },
                console_link: (function() {
                    var id = input.Id;
                    var region = input.Arn.split(":")[3];
                    return function() {
                        var html = `https://console.aws.amazon.com/medialive/home?region=${region}#/inputs/${id}`;
                        return html;
                    };
                })(),
                cloudwatch_link: (function() {
                    return function() {
                        var html = `https://console.aws.amazon.com/cloudwatch/home`;
                        return html;
                    };
                })()
            };
            node_data.image.selected = node_data.render.normal_selected();
            node_data.image.unselected = node_data.render.normal_unselected();
            nodes.update(node_data);
        };

        var map_multiplex = function(cache_entry) {
            var input = JSON.parse(cache_entry.data);

            // console.log('Input: %o', input);

            var name = input.Name;
            var id = input.Arn;
            var nodes = model.nodes;
            var node_type = "MediaLive Multiplex";
            var rgb = "#6a8258";
            var idle_rgb = svg_node.getIdleRgb();
            var degraded_rgb = svg_node.getDegradedRgb();
            var node_data = {
                cache_update: cache_entry.updated,
                id: input.Arn,
                region: cache_entry.region,
                shape: "image",
                image: {
                    unselected: null,
                    selected: null
                },
                header: `<b>${node_type}:</b> ${name}`,
                data: input,
                title: node_type,
                name: name,
                size: 55,
                render: {
                    normal_unselected: (() => node_map_handler(node_type, name, rgb, id, false, input))(),
                    normal_selected: (() => node_map_handler(node_type, name, rgb, id, true, input))(),
                    alert_unselected: (() => node_map_handler(node_type, name, "#ff0000", id, false, input))(),
                    alert_selected: (() => node_map_handler(node_type, name, "#ff0000", id, true, input))(),
                    degraded_unselected: (() => node_map_handler(node_type, name, degraded_rgb, id, false, input))(),
                    degraded_selected: (() => node_map_handler(node_type, name, degraded_rgb, id, true, input))(),
                },
                console_link: (function() {
                    var id = input.Id;
                    var region = input.Arn.split(":")[3];
                    return function() {
                        var html = `https://console.aws.amazon.com/medialive/home?region=${region}#/inputs/${id}`;
                        return html;
                    };
                })(),
                cloudwatch_link: (function() {
                    return function() {
                        return 'https://console.aws.amazon.com/cloudwatch/home';
                    };
                })()
            };
            node_data.image.selected = node_data.render.normal_selected();
            node_data.image.unselected = node_data.render.normal_unselected();
            nodes.update(node_data);
        };

        const update = () => new Promise((resolve, reject) => {
            region_promise()
                .then(regions => {
                    const promises = [];
                    for (let region_name of regions.get_selected()) {
                        promises.push(update_channels(region_name));
                        promises.push(update_inputs(region_name));
                        promises.push(update_multiplexes(region_name));
                    }

                    return Promise.all(promises);
                })
                .then(resolve)
                .catch(error => {
                    console.log(error);
                    reject(error);
                });
        });

        return { name: "MediaLive Inputs, Channels, Multiplexes", update: update };
    });