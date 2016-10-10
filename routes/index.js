var express = require('express');
var router = express.Router();
var passport = require('passport');
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;

var expressSession = require('express-session');
var sessionStore = new expressSession.MemoryStore;

router.use(expressSession({
  secret: 'somesecretmagicword',
  resave: 'true',
  saveUninitialized: 'true',
  store: sessionStore
}))

router.use(passport.initialize());
router.use(passport.session());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

var serviceRegex = /(SingleSignOn).*/;

var options = optional('./sso-credentials.json') || {
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

var client_id = options.credentials.clientId;
var client_secret = options.credentials.secret;
var authorization_url = options.credentials.authorizationEndpointUrl;
var token_url = options.credentials.tokenEndpointUrl;
var issuer_id = options.credentials.issuerIdentifier;

// you MUST change the host route to match your application name
var callback_url = 'https://insuranceagent.mybluemix.net/auth/sso/callback';

var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
var Strategy = new OpenIDConnectStrategy({
    authorizationURL: authorization_url,
    tokenURL: token_url,
    clientID: client_id,
    scope: 'openid',
    response_type: 'code',
    clientSecret: client_secret,
    callbackURL: callback_url,
    skipUserProfile: true,
    issuer: issuer_id
  },
  function (accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      done(null, profile);
    })
  });

passport.use(Strategy);


router.get('/login', passport.authenticate('openidconnect', {}));

router.get('/failure', function (req, res) {
  res.send('login failed');
});

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

router.get('/auth/sso/callback', function (req, res, next) {
  var redirect_url = req.session.originalUrl;
  passport.authenticate('openidconnect', {
    successRedirect: redirect_url,
    failureRedirect: '/failure',
  })(req, res, next);
});

/* GET home page. */
router.get('/', ensureAuthenticated, function (req, res, next) {
  res.render('index');
});


module.exports = router;