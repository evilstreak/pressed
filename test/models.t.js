var asserts = require( "test" ).asserts,
    mongo = require( "mongodb" ).MongoDB( "localhost" ),
    models = require( "../lib/app" ).juice.prototype.models,
    conf = {
      db : { host : "localhost", collection : "test.blog" },
      files : "~/blog"
    },
    app = { config : { app : conf } },
    Posts = new ( models.Posts )( app ),
    Tags = new ( models.Tags )( app );

// set up some reusable dates
var today = new Date(),
    tomorrow = new Date( today ),
    yesterday = new Date( today ),
    last_week = new Date( today );

tomorrow.setDate( tomorrow.getDate() + 1 );
yesterday.setDate( yesterday.getDate() - 1 );
last_week.setDate( last_week.getDate() - 7 );

// and some reusable posts
var a = { _id : "a", title : "Apple", tags : [ "one", "two", "three" ], published : last_week },
    b = { _id : "b", title : "Beetroot", tags : [ "two", "three" ], published : yesterday },
    c = { _id : "c", title : "Chicken", tags : [ "three" ], published : today },
    d = { _id : "d", title : "Apple", tags : [ "alpha" ], published : yesterday },
    e = { _id : "e", title : "Beetroot", tags : [ "beta" ], published : today },
    f = { _id : "f", title : "Chicken", tags : [ "gamma" ], published : tomorrow },
    g = { _id : "g", title : "Dandelion", tags : [ "delta" ] };

function setup( set ) {
  var data = [];

  switch ( set ) {
    case 1 :
      // case 1 is an empty set
      break;
    case 2 :
      data = [ a, b, c ];
      break;
    case 3 :
      data = [ d, e, f, g ];
      break;
  }

  // clear out what's there
  mongo.remove( "test.blog" );

  // insert the new records
  for ( var i = 0; i < data.length; ++i ) {
    mongo.insert( "test.blog", data[ i ] );
  }

  // make sure the insert is flushed
  mongo.findOne( "test.blog" );
}

exports.tests = {};

exports.tests.test_Tags = {
  test_all : function() {
    setup( 1 );
    asserts.same( Tags.all(), {}, "Empty object if all posts are untagged" );

    setup( 2 );
    asserts.same( Tags.all(), { one : 1, two : 2, three : 3 }, "Tag counts correct" );

    setup( 3 );
    asserts.same( Tags.all(), { alpha : 1, beta : 1 }, "Ignores unpublished posts" );
  }
}

exports.tests.test_Posts = {
  test_by_id : function() {
    setup( 2 );
    asserts.same( Posts.by_id( "a" ), a, "Returns correct post" );
    asserts.same( Posts.by_id( "z" ), null, "Returns null when the id doesn't exist" );
    asserts.same( Posts.by_id(), null, "Returns null if no id is given" );
  },

  test_by_tags : function() {
    setup( 2 );
    // single tags
    asserts.same( Posts.by_tags( [ "zero" ] ), [], "Returns no matching posts" );
    asserts.same( Posts.by_tags( [ "one" ] ), [ a ], "Returns the only matching post" );
    asserts.same( Posts.by_tags( [ "two" ] ), [ a, b ], "Returns all matching posts" );

    // multiple tags
    asserts.same( Posts.by_tags( [ "one", "two", "three" ] ), [ a ], "Returns posts matching all three tags" );
    asserts.same( Posts.by_tags( [ "one", "two", "three" ], true ), [ a, b, c ], "Returns posts matching any one tag" );

    setup( 3 );
    // unpublished
    asserts.same( Posts.by_tags( [ "gamma" ] ), [], "Doesn't return future posts" );
    asserts.same( Posts.by_tags( [ "delta" ] ), [], "Doesn't return draft posts" );
  }
}

if ( require.main === module ) {
  require( "test" ).runner( exports.tests );
}
