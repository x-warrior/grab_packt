var dotenv = require('dotenv')
dotenv.load({
    path: __dirname + '/.env'
});

var request = require('request');
var cheerio = require('cheerio');
var mkdirp = require('mkdirp');
var async = require("async");
var loginDetails = {
    email: process.env.PACKT_EMAIL,
    password: process.env.PACKT_PASSWORD,
    op: "Login",
    form_id: "packt_user_login_form",
    form_build_id: ""
};
var fs = require('fs');
var slugify = require('slugify');
var url = 'https://www.packtpub.com/packt/offers/free-learning';
var loginError = 'Sorry, you entered an invalid email address and password combination.';
var getBookUrl;
var bookTitle;

DEST_FOLDER = process.env.DEST_FOLDER
if (!DEST_FOLDER) {
    DEST_FOLDER = __dirname + '/downloads'
}

//we need cookies for that, therefore let's turn JAR on
request = request.defaults({
    jar: true
});

function download(url, path, callback) {
  request({uri: url})
      .pipe(fs.createWriteStream(path))
      .on('close', function() {
        console.log("Finished downloading: " + url)
        callback(null, url);
      });
}

function downloadIfDoesntExist(url, path, callback) {
    console.log("Downloading: " + url);
    fs.access(path, fs.F_OK, function(err) {
        if (!err) {
            console.log(path + ' file exists. Skipping.');
            callback(null, url);
        } else {
            download(url, path, callback);
        }
    });
}

function downloadBookVersions(bookTitle, getBookUrl) {
    bookTitle = slugify(bookTitle).toLowerCase();
    match = getBookUrl.match(/\/(.*)\/(.*)\/(.*)/);
    downloadUrl = 'https://www.packtpub.com/ebook_download/' + match[2];
    codeUrl = 'https://www.packtpub.com/code_download/' + match[2];
    pdfUrl = downloadUrl + '/pdf';
    epubUrl = downloadUrl + '/epub';
    mobiUrl = downloadUrl + '/mobi';

    destFolder = DEST_FOLDER + '/' + bookTitle;
    mkdirp(destFolder, function(err) {
        if (err) {
            console.log('----------- Packt Grab Done --------------');
            return;
        }

        async.parallel([
                function (cb) { 
                    downloadIfDoesntExist(pdfUrl, 
                        destFolder + '/' + bookTitle + '.pdf', 
                        cb
                    );
                },
                function (cb) { 
                    downloadIfDoesntExist(epubUrl, 
                        destFolder + '/' + bookTitle + '.epub', 
                        cb
                    );
                },
                function (cb) { 
                    downloadIfDoesntExist(mobiUrl, 
                        destFolder + '/' + bookTitle + '.mobi', 
                        cb
                    );
                }
            ], function (err, results) { console.log('----------- Packt Grab Done --------------'); });
        
    });
}

console.log('----------- Packt Grab Started -----------');
request(url, function(err, res, body) {
    if (err) {
        console.error('Request failed');
        console.log('----------- Packt Grab Done --------------');
        return;
    }

    var $ = cheerio.load(body);
    getBookUrl = $("a.twelve-days-claim").attr("href");
    bookTitle = $(".dotd-title").text().trim();
    var newFormId = $("input[type='hidden'][id^=form][value^=form]").val();

    if (newFormId) {
        loginDetails.form_build_id = newFormId;
    }

    request.post({
        uri: url,
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: require('querystring').stringify(loginDetails)
    }, function(err, res, body) {
        if (err) {
            console.error('Login failed');
            console.log('----------- Packt Grab Done --------------');
            return;
        };
        var $ = cheerio.load(body);
        var loginFailed = $("div.error:contains('"+loginError+"')");
        if (loginFailed.length) {
            console.error('Login failed, please check your email address and password');
            console.log('Login failed, please check your email address and password');
            console.log('----------- Packt Grab Done --------------');
            return;
        }

        request('https://www.packtpub.com' + getBookUrl, function(err, res, body) {
            if (err) {
                console.error('Request Error');
                console.log('----------- Packt Grab Done --------------');
                return;
            }

            var $ = cheerio.load(body);

            console.log('Book Title: ' + bookTitle);
            console.log('Claim URL: https://www.packtpub.com' + getBookUrl);

            downloadBookVersions(bookTitle, getBookUrl);

        });
    });
});