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
var passport = require('passport');
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
var expressSession = require('express-session');
var redis = require('redis');
var RedisStore = require('connect-redis')(expressSession);

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

/* GET home page. */
router.get('/', ensureAuthenticated, function (req, res, next) {
  res.render('index');
});


module.exports = router;