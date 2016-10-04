var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var request = require('request');
var Cloudant = require('cloudant');

// adjustors, banks, repair-facilities
router.get('/:database', function(req, res, next) {
    var database = req.params.database;

    var serviceRegex = /(cloudantNoSQLDB).*/;

    var options = optional('./cloudant-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    Cloudant(options.credentials.url, function(err, cloudant) {
        if (err) {
            res.status(500).send({status:500, message: 'Cloudant error failed to initialize'});
        }
        else {
            var names = {values: [], status: 200, message: 'ok'};
            var db = cloudant.db.use(database);
            db.get("_all_docs", {include_docs: true}, function(err, data) {
                if(!err && data) {
                    var rows = data.rows;
                    rows.forEach(function(value){
                        names.values.push(value.doc.name);
                    });
                    res.json(names);
                }
                else {
                    res.status(500).send({status:500, message: 'Cloudant error reading database'});
                }
            });
        }
    });
});

// claim-history/DG31826
router.get('/:database/:customer', function(req, res, next) {
    var database = req.params.database;
    var customer = req.params.customer;

    var serviceRegex = /(cloudantNoSQLDB).*/;

    var options = optional('./cloudant-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    Cloudant(options.credentials.url, function(err, cloudant) {
        if (err) {
            res.status(500).send({status:500, message: 'Cloudant error failed to initialize'});
        }
        else {
            var history = {values: []};
            var response = {status: 200, claim: {}, message: 'ok'};
            var db = cloudant.db.use(database);
            db.search('history', 'claims', {q: customer, include_docs: true}, function(err, data) {
                if(!err && data.rows.length > 0) {
                    response.claim.customer = data.rows[0].doc.customer;
                    response.claim.owner = data.rows[0].doc.owner;
                    response.claim.history = data.rows[0].doc.history;
                    response.claim.lastUpdate = data.rows[0].doc.lastUpdate;
                    res.json(response);
                }
                // empty but no error
                else if (!err){
                    res.json(response);
                }
                else {
                    res.status(500).send({status:500, message: 'Cloudant error reading database index'});
                }
            });
        }
    });
});


// claim-history 
router.post('/:database', function(req, res, next) {
    var database = req.params.database;

    var customer = req.body.customer;
    var owner = req.body.owner;

    var serviceRegex = /(cloudantNoSQLDB).*/;

    var options = optional('./cloudant-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    Cloudant(options.credentials.url, function(err, cloudant) {
        if (err) {
            res.status(500).send({status:500, message: 'Cloudant error failed to initialize'});
        }
        else {
            var db = cloudant.db.use(database);
            db.search('history', 'claims', {q: customer, include_docs: true}, function(err, data) {
                if(!err && data) {
                    // create the history record if it does not exist
                    if(data.rows.length == 0) {
                        var time = Date.now();
                        db.insert({customer: customer, owner: owner, history: [owner], lastUpdate: time}, 
                            function(err, body){
                                if(err) {
                                    res.status(500).send({status:500, message: 'Cloudant error creating claim history'});
                                }
                                else {
                                    res.json({status: 200});
                                }
                            });
                    }
                    // Update the history record there should only be one
                    else {
                        var rows = data.rows;
                        rows.forEach(function(value){
                            var record = value.doc;
                            record.owner = owner;
                            record.history.push(owner);
                            record.lastUpdate = Date.now();
                            db.insert(record, function(err, body){
                                if(err) {
                                    res.status(500).send({status:500, message: 'Cloudant error updating claim history'});
                                }
                            });
                        });
                        res.json({status: 200});
                    }
                }
                else {
                    res.status(500).send({status:500, message: 'Cloudant error reading database index'});
                }
            });
        }
    });
});

module.exports = router;