// http://101.78.220.133:8099/22.316109/114.180459
// http://101.78.220.133:8099/?lat=22.316109&lon=114.180459&zoom=18

var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var mongourl = 'mongodb://localhost:27017/test';


app.set('view engine', 'ejs');

app.use(express.static(__dirname +  '/public'));

app.get("/", function(req,res) {
	var lat  = req.query.lat;
	var lon  = req.query.lon;
	var zoom = req.query.zoom;

	res.render("gmap.ejs",{lat:lat,lon:lon,zoom:zoom});
	
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
