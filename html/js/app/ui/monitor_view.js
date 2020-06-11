/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "lodash", "app/model", "app/events", "app/cloudwatch_events", "app/ui/tile_view", "app/ui/diagrams", "app/alarms", "app/ui/confirmation"],
    function($, _, model, event_alerts, cw_events, tile_view, diagrams, alarms, confirmation) {

        var last_displayed;

        var alert_tabulator = new Tabulator("#nav-monitor-alerts-text", {
            placeholder: "No Recent Alerts",
            tooltips: true,
            selectable: false,
            height: 250,
            layout: "fitColumns",
            columns: [{
                title: "Event Source ARN",
                field: "resource_arn"
            }, {
                title: "Event Source Name",
                field: "name"
            }, {
                title: "Alert",
                field: "alert_type"
            }, {
                title: "Message",
                field: "message",
                widthGrow: 3
            }, {
                title: "Pipeline",
                field: "pipeline",
                widthGrow: 0
            }, {
                title: "Time",
                field: "time"
            }]
        });

        var alarm_tabulator = new Tabulator("#nav-monitor-alarms-text", {
            placeholder: "No Alarm Subscriptions",
            tooltips: true,
            selectable: true,
            selectableRangeMode: "click",
            selectablePersistence: true,
            height: 250,
            layout: "fitColumns",
            columns: [{
                title: "Subscriber ARN",
                field: "ARN"
            }, {
                title: "Subscriber Name",
                field: "name"
            }, {
                title: "Alarm Region",
                field: "Region"
            }, {
                title: "Alarm Namespace",
                field: "Namespace"
            }, {
                title: "Alarm Name",
                field: "AlarmName"
            }, {
                title: "Alarm State",
                field: "StateValue"
            }, {
                title: "Alarm State Updated",
                field: "StateUpdated"
            }, {
                tooltip: "Unsubscribe from Alarm",
                headerSort: false,
                formatter: "buttonCross",
                width: 40,
                align: "center",
                cellClick: function(e, cell) {
                    unsubscribe_alarm(cell.getRow()._row.data);
                }
            }]
        });

        //custom header filter
        var dateFilterEditor = function(cell, onRendered, success, cancel, editorParams){

            var container = $("<span></span>")
            //create and style input
            var start = $("<input type='text' placeholder='Start'/>");
            var end = $("<input type='text' placeholder='End'/>");

            container.append(start).append(end);

            var inputs = $("input", container);


            inputs.css({
                "padding":"4px",
                "width":"50%",
                "box-sizing":"border-box",
            })
            .val(cell.getValue());

            function buildDateString(){
                return {
                    start:start.val(),
                    end:end.val(),
                };
            }

            //submit new value on blur
            inputs.on("change blur", function(e){
                success(buildDateString());
            });

            //submit new value on enter
            inputs.on("keydown", function(e){
                if(e.keyCode == 13){
                    success(buildDateString());
                }

                if(e.keyCode == 27){
                    cancel();
                }
            });

            return container[0];
        }

        //custom filter function
        function dateFilterFunction(headerValue, rowValue, rowData, filterParams){
            //headerValue - the value of the header filter element
            //rowValue - the value of the column in this row
            //rowData - the data for the row being filtered
            //filterParams - params object passed to the headerFilterFuncParams property

            var format = filterParams.format || "DD/MM/YYYY";
            var start = moment(headerValue.start);
            var end = moment(headerValue.end);
            var value = moment(rowValue, format)
            // console.log(rowValue);
            // console.log(headerValue.start);
            // console.log(headerValue.end);
            if(rowValue){
                var current_row_millis = new Date(rowValue);
                console.log("current_row_millis: ");
                console.log(current_row_millis);
                var start_millis = 0;
                var end_millis = 0;
                if(start.isValid()){ 
                    if(end.isValid()){
                        start_millis = new Date(start);
                        end_millis = new Date(end);
                        console.log("start and end are given");
                        console.log(start_millis);
                        console.log(end_millis);
                        return current_row_millis >= start_millis && current_row_millis <= end_millis;
                    }else{ //only start was given
                        start_millis = new Date(start);
                        console.log("only start was given");
                        console.log(start_millis);
                        return current_row_millis >= start_millis;
                    }
                }else{ // no start but there is end
                    if(end.isValid()){
                        end_millis = new Date(end);
                        console.log("only end was given");
                        console.log(end_millis);
                        return current_row_millis <= end_millis;
                    }
                }
            }
            return true; //must return a boolean, true if it passes the filter.
        }

        var events_tabulator = new Tabulator("#nav-monitor-events-text", {
            placeholder: "No Recent CloudWatch Events",
            selectable: true,
            height: 250,
            layout: "fitColumns",
            resizableRows:true,
            initialSort:[
                {column:"timestamp", dir:"desc"}
            ],
            columns: [{
                title: "Time",
                field: "timestamp",
                headerFilter:dateFilterEditor,
                headerFilterFunc:dateFilterFunction
            }, {
                title: "Event Type",
                field: "type",
                headerFilter:true
            }, {
                title: "Data",
                field: "data",
                formatter: "html",
                headerFilter:true,
                widthGrow: 2
            }, {
                tooltip: "Formatted Data View",
                headerSort: false,
                formatter: "tickCross",
                formatterParams: {
                    tickElement:"<i class='fa fa-info-circle' style='font-size:20px'></i>",
                    crossElement:"<i class='fa fa-info-circle' style='font-size:20px'></i>"
                },
                width: 50,
                align: "center",
                cellClick: function(e, cell) {
                    show_formatted_cloudwatch_event_data(cell.getRow()._row.data);
                }
            }
        ]
        });


        var display_selected_node = function(node_id) {
            var node = model.nodes.get(node_id);
            last_displayed = node_id;
            var data = [];
            $("#nav-alarms-selected-item").html(node.header);
            $("#nav-alerts-selected-item").html(node.header);
            $("#nav-events-selected-item").html(node.header);

            // event alerts
            for (let event_value of event_alerts.get_cached_events().current) {
                if (event_value && event_value.resource_arn == node.id) {
                    event_value.detail.name = node.name;
                    event_value.detail.resource_arn = event_value.resource_arn;
                    data.push(event_value.detail);
                }
            }
            alert_tabulator.replaceData(data);
            // alarms
            require("app/alarms").alarms_for_subscriber(node.id).then(function(subscriptions) {
                // console.log(subscriptions);
                for (let subscription of subscriptions) {
                    if (Number.isInteger(subscription.StateUpdated)) {
                        subscription.StateUpdated = new Date(subscription.StateUpdated * 1000).toISOString();
                    }
                    subscription.ARN = node.id;
                    subscription.name = node.name;
                    subscription.id = node.id + ":" + subscription.Region + ":" + subscription.name;
                }
                alarm_tabulator.replaceData(subscriptions);
            });
            // cloudwatch events
            cw_events.get_cloudwatch_events(node.id).then(function(events){
                // console.log(events);
                for (let event of events) {
                    event.timestamp = new Date(event.timestamp).toISOString();
                }
                events_tabulator.replaceData(events);
            });
        };

        var display_selected_tile = function(name, members) {
            var alert_data = [];
            var alarm_data = [];
            var promises = [];
            $("#nav-alarms-selected-item").html("Tile: ".concat(name));
            $("#nav-alerts-selected-item").html("Tile: ".concat(name));
            for (let member_value of members) {
                var node = model.nodes.get(member_value.id);
                if (node) {
                    for (let event_value of event_alerts.get_cached_events().current) {
                        if (member_value.id == event_value.resource_arn) {
                            event_value.detail.name = node.name;
                            event_value.detail.resource_arn = event_value.resource_arn;
                            alert_data.push(event_value.detail);
                        }
                    }
                    promises.push(new Promise(function(resolve, reject) {
                        var local_node_id = member_value.id;
                        var local_node_name = node.name;
                        require("app/alarms").alarms_for_subscriber(local_node_id).then(function(subscriptions) {
                            // console.log(subscriptions);
                            for (let subscription of subscriptions) {
                                if (Number.isInteger(subscription.StateUpdated)) {
                                    subscription.StateUpdated = new Date(subscription.StateUpdated * 1000).toISOString();
                                }
                                subscription.ARN = local_node_id;
                                subscription.name = local_node_name;
                            }
                            alarm_data = alarm_data.concat(subscriptions);
                            resolve();
                        });
                    }));
                }
            }
            Promise.all(promises).then(function() {
                alarm_tabulator.replaceData(alarm_data);
                alert_tabulator.replaceData(alert_data);
                alarm_tabulator.redraw();
                alert_tabulator.redraw();
            });
        };

        var diagram_selection_listener = function(diagram, event) {
            if (event.nodes.length > 0) {
                last_displayed = event.nodes[0];
                display_selected_node(event.nodes[0]);
            }
        };

        var tile_view_click_listener = function(name, members) {
            if (tile_view.selected()) {
                last_displayed = {
                    name: name,
                    members: members
                };
                display_selected_tile(name, members);
            }
        };

        var event_alert_listener = function() {
            refresh();
        };

        tile_view.add_selection_callback(tile_view_click_listener);

        event_alerts.add_callback(event_alert_listener);

        alarms.add_callback(event_alert_listener);

        diagrams.add_selection_callback(function(diagram, event) {
            if (event.nodes.length > 0) {
                display_selected_node(event.nodes[0]);
            }
        });

        $("#monitor-subscribe-alarms-button").click(function() {
            require("app/ui/alarms_menu").show_alarm_subscribe_dialog();
        });

        $("#monitor-unsubscribe-alarms-button").click(function() {
            var selected_alarms = alarm_tabulator.getSelectedData();
            var diagram = diagrams.shown();
            var selected_nodes = diagram.network.getSelectedNodes();
            // console.log(selected_alarms);
            confirmation.show("Unsubscribe selected node" +
                (selected_nodes.length == 1 ? "" : "s") + " from " +
                selected_alarms.length + " alarm" +
                (selected_alarms.length == 1 ? "" : "s") + "?",
                function() {
                    var promises = [];
                    for (let alarm of selected_alarms) {
                        promises.push(alarms.unsubscribe_from_alarm(alarm.Region, alarm.AlarmName, selected_nodes));
                    }
                    Promise.all(promises).then(function() {
                        refresh();
                    });
                });
        });


        function unsubscribe_alarm(row) {
            console.log(row);
            var node = model.nodes.get(row.ARN);
            if (node) {
                // prompt if the node still exists
                confirmation.show("Unsubscribe " + node.header + " from alarm " + row.AlarmName + "?",
                    function() {
                        alarms.unsubscribe_from_alarm(row.Region, row.AlarmName, [row.ARN]).then(function() {
                            refresh();
                        });
                    });
            } else {
                // otherwise just delete it
                alarms.unsubscribe_from_alarm(row.Region, row.AlarmName, [row.ARN]).then(function() {
                    refresh();
                });
            }
        };

        function show_formatted_cloudwatch_event_data(row) {
            console.log(row);
            renderjson.set_show_to_level(1);
            var data = JSON.parse(row.data);
            var formatted_json = renderjson(data);
            $("#cloudwatch_event_data_json").html(formatted_json);
            $("#cloudwatch_event_data_view_modal").modal("show");
        };

        function refresh() {
            if (typeof last_displayed == 'string') {
                display_selected_node(last_displayed);
            } else if (typeof last_displayed == 'object') {
                display_selected_tile(last_displayed.name, last_displayed.members);
            }
        }

        return {
            refresh: refresh
        }

    });