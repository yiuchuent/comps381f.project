var express = require('express');
var session = require('cookie-session');
var ObjectId = require('mongodb')
    .ObjectId;
var url = require('url');
var MongoClient = require('mongodb')
    .MongoClient;
var mongourl = 'mongodb://proj:proj@ds159517.mlab.com:59517/proj';
//var qs = require('querystring');
var SECRETKEY = 'This is secretkey for comps381f project';
var bodyParser = require('body-parser');
var fileUpload = require('express-fileupload');
var app = express();


var data = '';

app.set('view engine', 'ejs');
app.use(fileUpload());
app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({entended: true})); 

app.use(session({
    secret: SECRETKEY,
    resave: true,
    saveUninitialized: true
}));

app.use(express.static(__dirname + '/public'));


app.get("/login", function(req, res) {
    res.render('login', {
        message: "Please Login"
    });
});

app.get("/rate", function(req, res) {

    var _id = req.query._id;
    res.render('rate', {
        _id: _id,
        message: ""
    });
});

app.post("/login", function(req, res) {
    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to db');

        db.collection('users')
            .findOne(req.body, function(err, result) {
                if(result != null) {
                    req.session.auth = true;
                    req.session.userId = result.userId;
                    console.log(result.userId + ' is logged in');
                    res.redirect('/');
                } else {
                    res.render('login', {
                        message: "wrong password/user id not exist."
                    });
                }
            });
    });
});


app.post("/register", function(req, res) {

    console.log(req.body);
	req.session = null;
    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to db');
		checkDuplicate(db, req.body.userId, function(result) {
			if (!result) {
				create(db, req.body.userId, req.body.password, req.body.email,
				    function(result) {
				        db.close();
				        if(result.insertedId != null) {
				            res.status(200);
				            res.redirect('/');
				        } else {
				            res.status(500);
				            res.end(JSON.stringify(result));
				        }
				    });
			} else {
				res.render('error', {message: "User name duplicate"});
			}

		});

    });
});

app.post("/rate", function(req, res) {
    var userid = req.session.userId;
    var score = req.body.score;
    var id = req.body._id;

    if(score < 1 || score > 10) {
        res.render('rate', {
            _id: id,
            message: 'Rating should be in range 1-10'
        });
        return;
    }

    MongoClient.connect(mongourl, function(err, db) {

        checkRate(db, userid, id, function(checkResult) {
            if(checkResult) {
                res.render('error', {
                    message: "You have already rated."
                })
            } else {
                rateRestaurant(db, userid, score, id, function(result) {
                    res.redirect('/display?_id=' + id);
                });
            }
        });


    });
});

function rateRestaurant(db, userid, score, id, callback) {
    db.collection('restaurants')
        .updateOne({
                "_id": ObjectId(id)
            }, {
                $push: {
                    grades: {
                        user: userid,
                        score: score
                    }
                }
            },
            function(err, result) {
                if(err) {
                    console.log('updateOne Error: ' + JSON.stringify(err));
                    result = err;
                } else {
                    console.log("Update _id = " + result.updatedId);
                }
                callback(result);
            });
}

function checkRate(db, userid, id, callback) {
    var result;
    db.collection('restaurants')
        .findOne({
            'grades.user': userid
        }, function(err, doc) {
            //console.log(JSON.stringify(doc));
            if(doc) {
                console.log('rated before');
                result = true;
                callback(result);
            } else {
                console.log('no rate before');
                result = false;
                callback(result);
            }
        });

}

function create(db, userId, password, email, callback) {
    db.collection('users')
        .insertOne({
            "userId": userId,
            "password": password,
            "email": email,
        }, function(err, result) {
            //assert.equal(err,null);
            if(err) {
                result = err;
                console.log("insertOne error: " + JSON.stringify(err));
            } else {
                console.log("Inserted _id = " + result.insertedId);
            }
            callback(result);
        });

}

app.get("/logout", function(req, res) {
    req.session = null;
    res.redirect('/');

});

app.get("/", function(req, res) {
    if(!req.session.auth) {
        res.redirect('/login');
    } else {
        res.redirect('/read');

    }

});

app.get("/read", function(req, res) {

    if(req.session.auth) {
		var criteria = req.query;

		if (!criteria.name) { delete criteria.name }
		if (!criteria.borough) { delete criteria.borough }
		if (!criteria.cuisine) { delete criteria.cuisine }
		console.log('criteria: '+ JSON.stringify(criteria));
        MongoClient.connect(mongourl, function(err, db) {

            getAll(db, criteria, function(list) {
                db.close();
                res.render("homepage", {
                    userId: req.session.userId,
                    restList: list,
					criteria: criteria
                });
            });
        });

    } else {
        res.redirect('/');
    }

});

app.get("/new", function(req, res) {
    if(req.session.auth) {
        res.render("createRestaurant", {
            message: ""
        });
    } else {
        res.redirect('/');
    }

});


var updateId;

app.get('/update', function(req, res) {
    updateId = req.query._id;

    if(req.session.auth) {
        MongoClient.connect(mongourl, function(err, db) {
            db.collection('restaurants')
                .findOne({
                    "_id": ObjectId(req.query._id)
                }, function(err, doc) {
                    if(doc != null && (req.session.userId == doc.userid)) {
                        //console.log('restaurant found: ' + JSON.stringify(doc));
                        db.close();
                        res.render("update", {
                            restaurant: doc,
                            message: ""
                        });
                    } else {
                        res.render("error", {
                            message: "Restaurant Not Found or you don't have the right"
                        })
                    }
                });
        });

    } else {
        res.redirect('/');
    }
});

app.post('/updateSubmit', function(req, res) {
    var userid = req.session.userId;
    console.log(updateId);

    if(req.body.name == "") {
        res.render("error", {
            message: "Restaurant must have a name"
        });
        return;
    }


    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to db');
        //console.log(req.files);
        console.log('name: ' + req.body.name);
        var userid = req.session.userId;


        updateRestaurant(db, req.files.photo, req.body, updateId, userid,
            function(result) {
                db.close();
                res.redirect('/read');
            });
    });
});



app.get("/showonmap", function(req, res) {
    var id = req.query.id;

    var lat;
    var lon;
    var zoom = 18;

    console.log('/showonmap ' + 'id: ' + id);
    MongoClient.connect(mongourl, function(err, db) {

        db.collection('cafes')
            .findOne({
                'id': id
            }, function(err, doc) {
                db.close();
                lat = doc.coord[0];
                lon = doc.coord[1];
                console.log('/showonmap ' + 'lat: ' + lat + ' lon: ' + lon);
                res.render("gmap.ejs", {
                    lat: lat,
                    lon: lon,
                    zoom: zoom
                });
                res.end();
            });
    });
});

app.post('/createRestaurant', function(req, res) {

    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to db');
        //console.log(req.files);
        console.log('name: ' + req.body.name);
        var userid = req.session.userId;

        if(!req.body.name) {
            console.log('empty name');
            res.render("createRestaurant", {
                message: "Please fill in name"
            });
            return;
        }

        createRestaurant(db, req.files.photo, req.body, userid,
            function(result) {
                db.close();
                if(result.insertedId != null) {
                    res.redirect('/read');
                } else {
                    res.status(500);
                    res.end(JSON.stringify(result));
                }
            });
    });
});

app.get('/display', function(req, res) {
    var userIdForUpdate = req.session.userId;
    console.log(userIdForUpdate);
    var zoom = 18;
    console.log(req.query._id);
    MongoClient.connect(mongourl, function(err, db) {
        db.collection('restaurants')
            .findOne({
                "_id": ObjectId(req.query._id)
            }, function(err, doc) {
                if(doc != null) {
                    //console.log('restaurant found: ' + JSON.stringify(doc));
                    db.close();
                    res.render("display", {
                        restaurant: doc,
                        zoom: zoom,
                        userIdForUpdate: userIdForUpdate
                    });
                } else {
                    res.render('error', "Restaurant Not Found")
                }
            });
    });
});

app.get('/delete', function(req, res) {
    var deleteId = req.query._id;
    MongoClient.connect(mongourl, function(err, db) {
        db.collection('restaurants')
            .findOne({
                '_id': ObjectId(deleteId)
            }, function(err, doc) {
                if(doc) {
                    if(req.session.userId == doc.userid) {
                        removeRestaurant(db, deleteId, function() {
                            db.close();
                            res.redirect('/');
                        });
                    } else {
                        res.render('error', {
                            message: "you don't have the right"
                        });
                    }
                } else {
                    res.render('error', {
                        message: "Restaurant Not Exist."
                    });
                }
            });
    });
});

app.get('/api/read/:r/:restName', function(req, res) {
	var restName = req.params.restName;
	var r = req.params.r;
	var criteria = {};
	criteria[r] = restName;
	console.log('API Read: '+ JSON.stringify(criteria));
	if (req.session.auth) {
		MongoClient.connect(mongourl, function(err, db) {
			getAll(db, criteria, function (restaurants) {
				db.close();
				res.end(JSON.stringify(restaurants));
			}); 
		});
	} else {
		res.redirect('/');
	}
	
});


function removeRestaurant(db, deleteId, callback) {
    deleteId = ObjectId(deleteId);
    db.collection('restaurants')
        .deleteOne({
            "_id": deleteId
        }, function(err, results) {
            console.log(results);
            callback();
        });
}

function createRestaurant(db, bfile, query, userid, callback) {
    console.log(bfile);
    db.collection('restaurants')
        .insertOne({
            "address": {
                "street": query.street,
                "zipcode": query.zipcode,
                "building": query.building,
                "coord": [query.lon, query.lat]
            },
            "borough": query.borough,
            "cuisine": query.cuisine,
            "name": query.name,
            "restaurant_id": null,
            "userid": userid,
            "grades": [],
            "data": new Buffer(bfile.data)
                .toString('base64'),
            "mimetype": bfile.mimetype
        }, function(err, result) {
            //assert.equal(err,null);
            if(err) {
                console.log('insertOne Error: ' + JSON.stringify(err));
                result = err;
            } else {
                console.log("Inserted _id = " + result.insertedId);
            }
            callback(result);
        });
}

function updateRestaurant(db, bfile, query, updateId, userid, callback) {
    console.log(bfile);
    console.log(updateId);
    db.collection('restaurants')
        .updateOne({
            "_id": ObjectId(updateId)
        }, {
            $set: {
                "address": {
                    "street": query.street,
                    "zipcode": query.zipcode,
                    "building": query.building,
                    "coord": [query.lon, query.lat]
                },
                "borough": query.borough,
                "cuisine": query.cuisine,
                "name": query.name,
                "restaurant_id": null,
                "userid": userid,
                "grades": [],
                "data": new Buffer(bfile.data)
                    .toString('base64'),
                "mimetype": bfile.mimetype
            }
        }, function(err, count, result) {
            //assert.equal(err,null);
            if(err) {
                console.log('updateOne Error: ' + JSON.stringify(err));
                result = err;
            } else {
                console.log("Update _id = " + JSON.stringify(result));
                console.log("Updated No. " + count);
            }
            callback(result);
        });
}


function getAll(db, criteria,callback) {
    var list = [];
    var cursor = db.collection('restaurants')
        .find(criteria, {
            data: 0
        });
    cursor.each(function(err, doc) {
        if(doc != null) {
            list.push(doc);
        } else {
            callback(list);
        }
    });
}

function checkDuplicate(db, userId, callback) {
	db.collection('users').findOne({userId: userId}, function(err, doc) {
		console.log(JSON.stringify('user duplicate: '+ doc));
		if (doc) {
			callback(true);
		} else {
			callback(false);
		}
	});
}

app.listen(process.env.PORT || 8099);
