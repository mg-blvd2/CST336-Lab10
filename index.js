var express = require("express");
var mysql = require("mysql");
var app = express();
var session = require("express-session");
var bcrypt = require('bcrypt');


/* Configure our server to read public folder and ejs files */
app.set('view engine', 'ejs');
app.use(express.static('public'));

//**********Sessions Middleware*******************
app.use(session({
    secret: 'top secret!',
    resave: true,
    saveUninitialized: true
}));

function checkPassword(password, hash){
    return new Promise(function(resolve, reject) {
      bcrypt.compare(password, hash, function(err, res){
          if(err) reject(err);
          resolve(res);
      });
    });
}

function isAuthenticated(req, res, next) {
    if(!req.session.authenticated) {
        res.redirect('/');
    } else {
        next();
    }
}

//Config MySQL DMBS
const connection = mysql.createConnection({
    host : 'localhost',
    user : 'mguijarro',
    password : 'mguijarro',
    database : 'quotes_db'
});

connection.connect();

app.use(express.urlencoded({extended: true}));

app.get("/", function(req, res) {
    console.log("Root Page Opened");
    res.render("home");
});

app.get("/searching", function(req, res) {
    console.log(req.query);
    var stmt = 'select * from l9_quotes, l9_author where ';
    if (req.query.searchType === 'category'){
        var searchTerm = req.query.searchTerm;
        stmt += "category='" + searchTerm + "' and l9_quotes.authorId=l9_author.authorId";
    } else if(req.query.searchType === 'name') {
        var searchTerm = req.query.searchTerm;
        searchTerm = searchTerm.split(' ');
        console.log("searchTerm = ", searchTerm);
        searchTerm.forEach((name, index) => {
            if(index != 0){
                stmt += " or ";
            }
            stmt += "(";
            stmt += "(l9_author.firstName='" + name + "' or l9_author.lastName='" + name + "')";
            stmt += " and l9_author.authorId=l9_quotes.authorId)";
        });
    } else if(req.query.searchType === 'keyword'){
        searchTerm = req.query.searchTerm;
        stmt += "l9_quotes.quote like '%" + searchTerm +  "%' and l9_quotes.authorId=l9_author.authorId"; 
    } else {
        searchTerm = req.query.searchTerm.toLowerCase();
        if(searchTerm === "m" || searchTerm === "male" || searchTerm === "f" || searchTerm == "female"){
            if(searchTerm === "m" || searchTerm === "male"){
                stmt += "l9_author.sex='M'";
            } else if(searchTerm === "f" || searchTerm == "female") {
                stmt += "l9_author.sex='F'";
            }
        } else {
            stmt += "l9_author.sex='M' and l9_author.sex='F'";
        }
        
        stmt += " and l9_quotes.authorId=l9_author.authorId";
    }
    
    console.log("stmt = ", stmt);

     connection.query(stmt, function(error, found) {
        var quotes = null;
        if(error) throw error;
        if(found.length){
            quotes = found;
        }
        
        console.log(quotes);
        res.render("results", {quotes: quotes});
     });
    
});

app.get('/login', function(req, res){
    res.render('login');
})

app.post('/login', function(req, res){
    var stmt = "SELECT * FROM l9_admin WHERE username='" + req.body.username + "'";
    connection.query(stmt, async function(error, found){
        if(error) throw error;
        
        if(found.length){
            var foundMatch = await checkPassword(req.body.userAuth, found[0].password);
            
            if(foundMatch){
                req.session.authenticated = true;
                res.redirect('/admin_page');
            } else {
                res.render('login', {"loginError":true});
            }
        } else {
            res.render('login', {"loginError": true});
        }
    });
});

app.get('/logout', function(req, res){
    req.session.destroy();
    res.redirect('/');
})

app.get('/admin_page', isAuthenticated, function(req, res) {
    console.log('You must be an admin!');
    var stmt = 'SELECT * FROM l9_author';
    var authors = null;
    
    connection.query(stmt, function(error, found) {
        
       if(error) throw error;
       
       if(found.length) {
           authors = found;
       }
       
       res.render('admin', {data: authors});
    });
});

app.get('/newAuthor', isAuthenticated, function(req, res){
    var stmt = "SELECT COUNT(*) FROM l9_author";
    
    connection.query(stmt, function(error, found){
        if(error) throw error;
        
        res.render('newAuthor', {newIdx: found[0]['COUNT(*)'] + 1});
    })
   
});

app.get('/editAuthor', isAuthenticated, function(req, res){
    var stmt = "SELECT * FROM l9_author WHERE authorId='" + req.query.authorIdx + "';";
    
    connection.query(stmt, function(error, found) {
        if(error) throw error;
        
        if(found.length){
            res.render('newAuthor', {'authorIdx': req.query.authorIdx, info: found[0]});
        } else {
            res.render('newAuthor', {notFound: true});
        }
    })
});

app.post('/newAuthor', isAuthenticated, function(req, res) {
    var getCount = 'SELECT COUNT(*) FROM l9_author';
    
    connection.query(getCount, function(error, found){
      if(error) throw error;
      if(found[0]["COUNT(*)"] < req.body.id) {
            console.log('in if');
          var insertStmt = "INSERT INTO l9_author (authorId, firstName, lastName, dob, dod, sex, profession, country, portrait, biography) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            var values = [req.body.id, req.body.firstName, req.body.lastName, req.body.dob, req.body.dod,
                        req.body.gender, req.body.profession, req.body.country, req.body.portrait, req.body.biography];
            connection.query(insertStmt, values, function(error, found){
                if(error) throw error;
                
                res.redirect('/admin_page');
            });
      } else {
            var updateStmt = 'UPDATE l9_author SET firstName = ?, lastName = ?, dob = ?, dod = ?, sex = ?, ' +
                            'profession = ?, country = ?, portrait = ?, biography = ? WHERE authorId = ?';
            var values = [req.body.firstName, req.body.lastName, req.body.dob, req.body.dod,
                        req.body.gender, req.body.profession, req.body.country, req.body.portrait, req.body.biography, req.body.id];
                        
            connection.query(updateStmt, values, function(error, found) {
               if(error) throw error;
               
               res.redirect('/admin_page');
            });
      }
    });
});

app.post('/delete', isAuthenticated, function(req, res) {
    var getCount = 'SELECT COUNT(*) FROM l9_author';
    
    connection.query(getCount, function(error, found) {
        var deleteStmt = 'DELETE FROM l9_author WHERE authorId = ?';
        var vals = [parseInt(req.body.authorIdx)];
        
        connection.query(deleteStmt, vals, function(error, found) {
           if(error) throw error;
           
           var updateNums = 'UPDATE l9_author SET authorId = authorId - 1 where authorId > ?';
           
           connection.query(updateNums, vals, function(error, found) {
               if(error) throw error;
               
               res.redirect('/admin_page');
           })
           
        });
    })
    
});

app.get("/*", function(req, res){
    console.log("Error Page Loaded");
    res.render("error");
});

app.listen(process.env.PORT || 3000, function(){
    console.log('Server has been started');
});