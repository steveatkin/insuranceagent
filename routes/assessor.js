var express = require('express');
var router = express.Router();

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}


/* GET home page. */
router.get('/', ensureAuthenticated, function(req, res, next) {
  res.render('assessor');
});

module.exports = router;