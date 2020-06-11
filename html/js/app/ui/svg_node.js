/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["jquery", "lodash", "app/window", "app/ui/util", "app/plugins"], function($, _, window, ui_util, plugins) {
    const max_line_length = 25;
    const font_family = 'Arial';
    const work_div_id = ui_util.makeid();
    const work_div_style = 'overflow:hidden;top:-100%;left:-100%;position:absolute;opacity:0;';
    const work_div_html = `<div id="${work_div_id}" style="${work_div_style}"></div>`;
    const border_rgb = "#a6a6a6";
    const selected_border_rgb = "#262626";
    const degraded_rgb = "#ffff33";
    const idle_rgb = "#949898";

    const wordWrap = (str, max) => str.length > max ? [`${str.substring(0, max - 1)} [...]`] : [str];

    const create = (type_name, node_name, node_rgb, selected, id, data) => {
        const inc_y = 35;
        const radius = 20;
        const width = 400;
        const height = 200;
        const font_size = 25;
        const w_border = selected ? Math.ceil(width * 0.05) : Math.ceil(width * 0.025);
        let pos_y = 10;

        $("#" + work_div_id).empty();

        const drawing = SVG(work_div_id).size(width, height);
        drawing.rect(width, height).radius(radius).fill(selected ? selected_border_rgb : border_rgb);
        drawing.rect(width - w_border, height - w_border).radius(radius).fill(node_rgb).dmove(w_border / 2, w_border / 2);

        const typeLabel = drawing.text(type_name + ":").y(pos_y);
        typeLabel.font({ family: font_family, size: font_size, weight: 'bold' });
        typeLabel.cx(width / 2);

        pos_y += inc_y;

        const lines = wordWrap(node_name, max_line_length);

        for (let value of lines) {
            const nameLabel = drawing.text(value).y(pos_y);
            nameLabel.font({ family: font_family, size: font_size });
            nameLabel.cx(width / 2);
            pos_y += inc_y;
        }

        // give matching overlays a chance to supplement 'drawing'
        let found = false;
        const overlays = plugins.overlays;

        for (let module of overlays) {
            let overlay = require(module);
            if (overlay.match_type == type_name) {
                // console.log("applying overlay " + overlay.name);
                overlay.decorate(drawing, font_size, width, height, id, data);
                found = true;
            }
        }

        // use the default overlay if needed
        if (!found) {
            // console.log("using default overlay for " + id)
            let overlay = require(plugins["default-overlay"]);
            overlay.decorate(drawing, font_size, width, height, id, data);
        }

        // export the SVG and turn it into an encoded inline image
        const code = drawing.svg();
        // remove randomly generated ids from the SVG code
        const regex = /id\=\"\w+\"\s*/g;
        const modified = code.replace(regex, "");
        // console.log(modified);
        return 'data:image/svg+xml;base64,' + window.btoa(modified);
    };

    /** add the hidden SVG rendering div to the end of the body */
    $("body").append(work_div_html);

    return {
        selected: (type_name, node_name, node_rgb, id, data) =>
            create(type_name, node_name, node_rgb, true, id, data),
        unselected: (type_name, node_name, node_rgb, id, data) =>
            create(type_name, node_name, node_rgb, false, id, data),
        getIdleRgb: () => idle_rgb,
        getDegradedRgb: () => degraded_rgb,
    };
});