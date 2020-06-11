/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "lodash", "app/model", "app/events", "app/ui/diagrams"], function ($, _, model, event_alerts, diagrams) {
    const updateAlertHandler = (node, alertState = true, data = null) => {
        let selected = null;
        let unselected = null;
        let msg = '\n- Updated Node Alert => %o';

        if (node.idle) {
            msg += '\n\t* Alert State Updated to IDLE';
            selected = node.render.idle_selected();
            unselected = node.render.idle_unselected();
        } else if (node.degraded) {
            msg += '\n\t* Alert State Updated to DEGRADED';
            selected = node.render.degraded_selected();
            unselected = node.render.degraded_unselected();
        } else if (node.alerting) {
            msg += '\n\t* Alert State Updated to ALERTING';
            selected = node.render.alert_selected();
            unselected = node.render.alert_unselected();
        } else {
            msg += '\n\t* Alert State Updated to NORMAL';
            selected = node.render.normal_selected();
            unselected = node.render.normal_unselected();
        }

        if (selected != node.image.selected || unselected != node.image.unselected) {
            if (selected != node.image.selected)
                msg += '\n\t* Updated Selected';
            if (unselected != node.image.unselected)
                msg += '\n\t* Updated Unselected';

            node.image.selected = selected;
            node.image.unselected = unselected;
            model.nodes.update(node);

            if (data)
                msg += '\n\t* Reason for Change => %o';

            console.log(msg, node, data, '\n');

            const matches = diagrams.have_all([node.id]);
            for (let diagram of matches) {
                diagram.nodes.update(node);
                diagram.alert(alertState);
            }
        }
    };

    const updateEventAlertState = (current_alerts, previous_alerts) => {
        /** iterate through current 'set' alerts */
        const idle_nodes = [];
        const alerting_nodes = [];
        const inactive_nodes = [];
        const degraded_nodes = [];

        console.log("event alert indicator get cached events");
        //console.log(event_alerts.get_cached_events());
        current_alerts = event_alerts.get_cached_events().current_medialive;
        previous_alerts = event_alerts.get_cached_events().previous_medialive;

        for (let item of current_alerts) {
            const node = model.nodes.get(item.resource_arn);

            if (node) {
                node.alerting = true;
                node.degraded = _.has(item, 'detail') && _.has(item.detail, 'degraded')
                    ? item.detail.degraded : false;
                node.idle = _.has(item, 'detail') && _.has(item.detail, 'idle_state')
                    ? item.detail.idle_state : false;

                if (node.idle) {
                    if (!idle_nodes.includes(item.resource_arn)) {
                        idle_nodes.push(item.resource_arn);
                        updateAlertHandler(node, false, item);
                    }
                } else if (node.degraded) {
                    if (!degraded_nodes.includes(item.resource_arn)) {
                        degraded_nodes.push(item.resource_arn);
                        updateAlertHandler(node, true, item);
                    }
                } else {
                    /**
                    * if node is not degraded, we still need to check that the resource_arn
                    * is not included in the degraded_nodes array. If it is, that means
                    * the other pipeline is degraded, therefore we do not alert.
                    */
                    if (!alerting_nodes.includes(item.resource_arn) && 
                        !degraded_nodes.includes(item.resource_arn) && 
                        !idle_nodes.includes(item.resource_arn)) {
                            alerting_nodes.push(item.resource_arn);
                            updateAlertHandler(node, true, item);
                    }
                }
            }
        }

        /** calculate the current alerts not included in the previous alerts */
        for (let previous of previous_alerts) {
            let found = false;

            for (let arn of alerting_nodes) {
                found = found || arn === previous.resource_arn;
                if (found) {
                    break;
                }
            }

            if (!found) {
                for (let arn of idle_nodes) {
                    found = found || arn === previous.resource_arn;
                    if (found) {
                        break;
                    }
                }
            }

            if (!found) {
                inactive_nodes.push(previous.resource_arn);
            }
        }

        /** 'unalert' the nodes that are no longer alerting */
        /** id => resource_arn */
        for (let arn of inactive_nodes) {
            const node = model.nodes.get(arn);

            if (node) {
                node.alerting = false;
                node.degraded = _.includes(degraded_nodes, arn);
                node.idle = _.includes(idle_nodes, arn);

                let item = _.find(previous_alerts, ({ resource_arn }) => node.id === resource_arn);
                if (!item) {
                    item = _.find(current_alerts, ({ resource_arn }) => node.id === resource_arn);
                }

                /** this is node.data.State value */
                const previous_node_state = node.data['State'];
                /** this is node.data.idle_state value */
                const previous_idle_state = node.data.idle_state;

                /** 
                 * both values can be different. event though a value of previous_node_state === "IDLE" 
                 * the previous_idle_state === false;
                 * This is because `idle_state` is already set in the response from the server and
                 * `State` is just the value provided to us via the AWS API on the backend.
                 */

                const curItem = _.find(current_alerts, ({ resource_arn }) => 
                    node.id === resource_arn);
                const prevItem = _.find(previous_alerts, ({ resource_arn }) => 
                    node.id === resource_arn);

                if (curItem && prevItem) {
                    /** this item is part of previous and current alerts */
                    const previous_state = _.has(prevItem, 'detail') && _.has(prevItem.detail, 'State')
                        ? item.detail.idle_state : false;
                }

                updateAlertHandler(node, false, item);

                console.log('\n- Unalert Data:\n\tCurrent Alerts => %o\n\tPrevious Alerts => %o\n', current_alerts, previous_alerts);
            }
        }
    };

    event_alerts.add_callback(updateEventAlertState);
});