var express = require('express');
var session = require('cookie-session');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var mongourl = 'mongodb://localhost:27017/test';
var qs = require('querystring');
var SECRETKEY = 'This is secretkey for comps381f project';
var bodyParser = require('body-parser');


var data = '';

app.set('view engine', 'ejs');

app.use(session({
	secret: SECRETKEY,
	resave: true,
	saveUninitialized: true
}));

app.use(express.static(__dirname +  '/public'));
app.use(bodyParser.json());

app.post("/register", function(req,res) {

	console.log(req.body.userId);
      MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to db');

      create(db,req.body.userId,req.body.password,req.body.email,
	function(result) {
          db.close();
          if (result.insertedId != null) {
            res.status(200);
            res.end('Inserted: ' + result.insertedId);
          } else {
            res.status(500);
            res.end(JSON.stringify(result));
          }
      });
    });
});

function create(db,userId,password,email,callback) {
  db.collection('test').insertOne({
    "userId" : userId,
    "password" : password,
    "email" : email,
  }, function(err,result) {
    //assert.equal(err,null);
    if (err) {
      result = err;
      console.log("insertOne error: " + JSON.stringify(err));
    } else {
      console.log("Inserted _id = " + result.insertedId);
    }
    callback(result);
  });
}

app.get("/logout", function(req,res) {
	req.session = null;
	res.redirect('/');
	
});

app.get("/", function(req,res) {
	if (!req.session.auth) {
		res.redirect('/login');
	} else {
		res.end('hello');
	}
	
});

app.get("/showonmap", function(req,res) {
	var id = req.query.id;

	var lat;
	var lon;
	var zoom = 18;

	console.log('/showonmap ' + 'id: ' + id);
	MongoClient.connect(mongourl, function(err, db) {

		db.collection('cafes').findOne({'id': id}, function(err, doc) {
			db.close();
			lat = doc.coord[0];
			lon = doc.coord[1];
			console.log('/showonmap ' + 'lat: ' + lat + ' lon: ' + lon);	
			res.render("gmap.ejs",{lat:lat,lon:lon,zoom:zoom});
			res.end();
		});
	});	
});

app.get('/list', function(req,res) {
	MongoClient.connect(mongourl, function(err, db) {

		getAll(db, function(list) {
			db.close();
			res.render('list', {list: list});
			res.end();
		});
	});		
});

function getAll(db, callback) {
	var list = [];
	var cursor = db.collection('cafes').find();
	cursor.each(function(err, doc) {
		if (doc != null) {
			list.push(doc);
		} else {
			callback(list);
		}
	});
}

app.listen(process.env.PORT || 8099);
	
