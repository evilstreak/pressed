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
    d = { _id : "d", title : "Dandelion", tags : [ "alpha" ], published : yesterday },
    e = { _id : "e", title : "Elephant", tags : [ "beta" ], published : today },
    f = { _id : "f", title : "Fuschia", tags : [ "gamma" ], published : tomorrow },
    g = { _id : "g", title : "Gargoyle", tags : [ "delta" ] },
    h = { _id : "h", title : "Hotel", published : new Date( "1 September, 2000" ) },
    i = { _id : "i", title : "Igloo", published : new Date( "2 September, 2000" ) },
    j = { _id : "j", title : "Jelly", published : new Date( "1 October, 2000" ) },
    k = { _id : "k", title : "Kerosene", published : new Date( "2 October, 2000" ) },
    l = { _id : "l", title : "Lamentable", published : new Date( "3 March, 2001" ) };

function setup( data ) {
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
    setup( [ h, i, j ] );
    asserts.same( Tags.all(), {}, "Empty object if all posts are untagged" );

    setup( [ a, b, c ] );
    asserts.same( Tags.all(), { one : 1, two : 2, three : 3 }, "Tag counts correct" );

    setup( [ d, e, f, g ] );
    asserts.same( Tags.all(), { alpha : 1, beta : 1 }, "Ignores unpublished posts" );
  }
}

exports.tests.test_Posts = {
  test_by_id : function() {
    setup( [ a, b, c ] );
    asserts.same( Posts.by_id( "a" ), a, "Returns correct post" );
    asserts.same( Posts.by_id( "z" ), null, "Returns null when the id doesn't exist" );
    asserts.same( Posts.by_id(), null, "Returns null if no id is given" );
  },

  test_by_tags : function() {
    setup( [ a, b, c ] );
    // single tags
    asserts.same( Posts.by_tags( [ "zero" ] ), [], "Returns no matching posts" );
    asserts.same( Posts.by_tags( [ "one" ] ), [ a ], "Returns the only matching post" );
    asserts.same( Posts.by_tags( [ "two" ] ), [ a, b ], "Returns all matching posts" );

    // multiple tags
    asserts.same( Posts.by_tags( [ "one", "two", "three" ] ), [ a ], "Returns posts matching all three tags" );
    asserts.same( Posts.by_tags( [ "one", "two", "three" ], true ), [ a, b, c ], "Returns posts matching any one tag" );

    setup( [ d, e, f, g ] );
    // unpublished
    asserts.same( Posts.by_tags( [ "gamma" ] ), [], "Doesn't return future posts" );
    asserts.same( Posts.by_tags( [ "delta" ] ), [], "Doesn't return draft posts" );
  }
}

if ( require.main === module ) {
  require( "test" ).runner( exports.tests );
}
