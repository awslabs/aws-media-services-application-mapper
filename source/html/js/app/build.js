/*! Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
       SPDX-License-Identifier: Apache-2.0 */

define(["app/server"], function(server) {

    var stamp = "1620858083";

    return {
        "get_timestamp": function() {
            return stamp;
        }
    };

});
