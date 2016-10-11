/*	
 * Copyright IBM Corp. 2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Steven Atkin
 */


var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var request = require('request');
var Cloudant = require('cloudant');

var serviceRegex = /(cloudantNoSQLDB).*/;

var options = optional('./cloudant-credentials.json') || {
    appEnv: appEnv
};

// parse vcap using cfenv if available
if (options.appEnv && !options.credentials) {
    options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
}
// try again with name
else if (options.appEnv && !options.credentials) {
    options.credentials = options.appEnv.getServiceCreds(serviceRegex);
}

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

// adjustors, banks, repair-facilities
router.get('/:database', ensureAuthenticated, function (req, res, next) {
    var database = req.params.database;

    Cloudant(options.credentials.url, function (err, cloudant) {
        if (err) {
            res.status(500).send({
                status: 500,
                message: 'Cloudant error failed to initialize'
            });
        } else {
            var names = {
                values: [],
                status: 200,
                message: 'ok'
            };
            var db = cloudant.db.use(database);
            db.get("_all_docs", {
                include_docs: true
            }, function (err, data) {
                if (!err && data) {
                    var rows = data.rows;
                    rows.forEach(function (value) {
                        names.values.push(value.doc.name);
                    });
                    res.json(names);
                } else {
                    res.status(500).send({
                        status: 500,
                        message: 'Cloudant error reading database'
                    });
                }
            });
        }
    });
});

// claim-history/DG31826
router.get('/:database/:customer', ensureAuthenticated, function (req, res, next) {
    var database = req.params.database;
    var customer = req.params.customer;

    var serviceRegex = /(cloudantNoSQLDB).*/;

    var options = optional('./cloudant-credentials.json') || {
        appEnv: appEnv
    };

    // parse vcap using cfenv if available
    if (options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if (options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    Cloudant(options.credentials.url, function (err, cloudant) {
        if (err) {
            res.status(500).send({
                status: 500,
                message: 'Cloudant error failed to initialize'
            });
        } else {
            var history = {
                values: []
            };
            var response = {
                status: 200,
                claim: {},
                message: 'ok'
            };
            var db = cloudant.db.use(database);
            db.search('history', 'claims', {
                q: customer,
                include_docs: true
            }, function (err, data) {
                if (!err && data.rows.length > 0) {
                    response.claim.customer = data.rows[0].doc.customer;
                    response.claim.state = data.rows[0].doc.state;
                    response.claim.history = data.rows[0].doc.history;
                    res.json(response);
                }
                // empty but no error
                else if (!err) {
                    res.json(response);
                } else {
                    res.status(500).send({
                        status: 500,
                        message: 'Cloudant error reading database index'
                    });
                }
            });
        }
    });
});


// claim-history 
router.post('/:database', ensureAuthenticated, function (req, res, next) {
    var database = req.params.database;

    var customer = req.body.customer;
    var owner = req.body.owner;
    var role = req.body.role;
    var state = req.body.state;

    var reset = req.body.reset;

    var serviceRegex = /(cloudantNoSQLDB).*/;

    var options = optional('./cloudant-credentials.json') || {
        appEnv: appEnv
    };

    // parse vcap using cfenv if available
    if (options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if (options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    Cloudant(options.credentials.url, function (err, cloudant) {
        if (err) {
            res.status(500).send({
                status: 500,
                message: 'Cloudant error failed to initialize'
            });
        } else {
            var db = cloudant.db.use(database);
            db.search('history', 'claims', {
                q: customer,
                include_docs: true
            }, function (err, data) {
                if (!err && data) {
                    // create the history record if it does not exist
                    if (data.rows.length == 0) {
                        db.insert({
                                customer: customer,
                                state: state,
                                history: [{
                                    owner: owner,
                                    role: role,
                                    date: Date.now()
                                }]
                            },
                            function (err, body) {
                                if (err) {
                                    res.status(500).send({
                                        status: 500,
                                        message: 'Cloudant error creating claim history'
                                    });
                                } else {
                                    res.json({
                                        status: 200
                                    });
                                }
                            });
                    }
                    // Update the history record there should only be one
                    else {
                        var rows = data.rows;

                        if (rows.length > 0) {
                            var record = rows[0].doc;
                            record.state = state;

                            // erase the old history and start the history over
                            if (reset === true) {
                                record.history = [{
                                    owner: owner,
                                    role: role,
                                    date: Date.now()
                                }];
                            }
                            // append to the existing history
                            else {
                                record.history.push({
                                    owner: owner,
                                    role: role,
                                    date: Date.now()
                                });
                            }

                            db.insert(record, function (err, body) {
                                if (err) {
                                    res.status(500).send({
                                        status: 500,
                                        message: 'Cloudant error updating claim history'
                                    });
                                } else {
                                    res.json({
                                        status: 200
                                    });
                                }
                            });
                        }
                    }
                } else {
                    res.status(500).send({
                        status: 500,
                        message: 'Cloudant error reading database index'
                    });
                }
            });
        }
    });
});

module.exports = router;