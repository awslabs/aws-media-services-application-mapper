/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "lodash", "app/events", "app/alarms", "app/ui/overlays/overlay_tools", "app/model"],
    function($, _, alert_events, alarms, tools, model) {

        var match_type = "MediaConnect Flow";

        var decorate_alarms = function(drawing, font_size, width, height, id) {
            var alarm_count = 0;
            for (let item of alarms.get_subscribers_with_alarms().current) {
                if (item.ResourceArn == id) {
                    alarm_count += item.AlarmCount;
                }
            }
            tools.set_alarm_text(alarm_count, drawing, font_size, width);
        };

        var decorate_information = function(drawing, font_size, width, height, id) {
            var node = model.nodes.get(id);
            if (node) {
                var source_type = "Standard";
                if (node.data.Source.EntitlementArn) {
                    source_type = "Entitlement";
                }
                tools.set_info_text(source_type, drawing, font_size, width);
            }
        };

        var decorate_alerts = function(drawing, font_size, width, height, id) {
            let alert_count = 0;
            const cached_events = alert_events.get_cached_events();

            /** 
             * Originally, `cached_events` would only have `{current [], previous: []}`.
             * Now we are checking for `current_mediaconnect` which is not defined in the `cached_events`
             * object. Therefore, we validate its presence and only defined, run the following block
             * of code.
             * This way we dont break the preexisting logic.
             */
            if (_.has(cached_events, 'current_mediaconnect')) {
                for (let item of cached_events.current_mediaconnect) {
                    if (item.resource_arn == id) {
                        alert_count += 1; 
                    }
                }
                tools.set_event_text(alert_count, drawing, font_size, width, "Alerts");
            }
        };

        var decorate = function(drawing, font_size, width, height, id) {
            decorate_alarms(drawing, font_size, width, height, id);
            decorate_alerts(drawing, font_size, width, height, id);
            decorate_information(drawing, font_size, width, height, id);
        };

        return { match_type, decorate, informational: true };
    });