// Don't mess these first few lines
const juice = require('juice'),
      DOC_ROOT = module.uri.replace(/^.*?:\/\/(.*?)lib\/app\.js$/, "$1") || "./";

// temporary Template hackery
delete require( "Template" ).Template.Stash.PRIVATE;

var app = new juice.Application;

app.models.Blog = {
  all : function( query, sort ) {
    // default query to an empty object
    query = query || {};

    var cursor = db.find( conf.db.collection, query ),
        posts = [], p;

    // sort if needed
    if ( sort ) {
      cursor.sort( sort );
    }

    while ( ( p = cursor.next() ) ) {
      posts.push( p );
    }

    return posts;
  },

  by_id : function( id ) {
    return db.findOne( conf.db.collection, { _id : id } );
  },

  /**
   * Blog.by_tags( tags, [ union ] ) -> Array
   * - tags (Array): a list of tags to search by
   * - union (Boolean): true to find posts with every tag, false for any
   */
  by_tags : function( tags, union ) {
    var query = { tags : {} };
    query.tags[ ( union ? "$in" : "$all" ) ] = tags;
    return this.all( query );
  },

  // FIXME
  by_date : function( from, to ) {
    // default to now if to isn't provided
    to = to || new Date();
    return [];
  },

  /**
   * Blog.recent( [count] ) -> Array
   * - count (Integer): the number of posts to return, defaults to 5
   */
  recent : function( count ) {
    // default to 5 if none provided
    return this.all(
      { published : { $lte : new Date() } },
      { published : -1 }
    ).slice( 0, count || 5 );
  },

  /**
   * Blog.sync()
   *
   * Syncs the changes on the filesystem into the database.
   */
  sync : function() {
    print( "syncing..." );
    const fs = require( "fs-base" ),
          markdown = require( "markdown" );

    // utility function for extracting the attribute node from JsonML
    function extract_attr( jsonml ) {
      return jsonml.length > 1
          && typeof jsonml[ 1 ] === "object"
          && !( jsonml[ 1 ] instanceof Array )
          ? jsonml[ 1 ]
          : undefined;
    }

    var path = conf.files,
        fs_posts = fs.list( path ).filter( function( x ) x.indexOf( "." ) !== 0 );

    for ( p in fs_posts ) {
      // use filename as id
      var post = { _id : fs_posts[ p ] },
          db_post = db.findOne( conf.db.collection, post );

      var post_path = path + "/" + post._id;
      post.updated = fs.lastModified( post_path );

      // check last modified times to see if we need to update
      if ( db_post && db_post.updated >= post.updated ) {
        continue;
      }

      // parse the new/updated content
      var raw = fs.rawOpen( post_path, "r" ).readWhole(),
          md = new ( markdown.Markdown )( "Maruku" ),
          tree = md.toTree( raw ),
          attr = extract_attr( tree );

      post.content = markdown.toHTML( tree );

      // document meta
      for ( key in attr ) {
        var value = attr[ key ];

        switch ( key ) {
          // treat published as a date
          case "published":
            value = new Date( value );
            break;
          // treat tags as a comma separated array
          case "tags":
            value = value.split( /\s*,\s*/ );
            break;
        }

        post[ key ] = value;
      }

      // save the post
      db.update( conf.db.collection, { _id : post._id }, post, true );

      print( "  updated", post._id );
    }

    // delete any posts we didn't come across (i.e. the files have been deleted)
    db.remove( conf.db.collection, { _id : { $nin : fs_posts } } );
  },

  /**
   * Blog.tags() -> Object
   *
   * Get a list of all tags used on every post with a count, e.g.:
   *     { games : 1, books : 8, music : 3 }
   */
  tags : function() {
    var cursor = db.find( conf.db.collection, {}, { tags : 1 } ),
        tags = {}, p;

    while ( ( p = cursor.next() ) ) {
      for ( var i = 0; i < p.tags.length; ++i ) {
        // increment it or set it to 1 if it's not set
        tags[ p.tags[ i ] ] = ++tags[ p.tags[ i ] ] || 1;
      }
    }

    return tags;
  }
}

// used to add common data in used on every page (in footers, sidebars etc)
app.build_data = function( data ) {
  data.tags = this.models.Blog.tags();
  data.recent = this.models.Blog.recent( 5 );
  return data;
}

// home page, nothing but a list of recent posts
app.controllers.index = function() {
  // all the interesting data is available through build_data anyway
  return this.build_data( {} );
}

// single blog post by id, 404 if not found in the database
app.controllers.blog_post = function( id ) {
  var post = this.models.Blog.by_id( id );

  // return a 404 if it doesn't exist
  if ( !post ) {
    return {};
  }

  return this.build_data( { post : post } );
}

// list all posts with the given tag
app.controllers.tags = function( tag ) {
  var posts = this.models.Blog.by_tags( [ tag ] );

  // return a 404 if none were found
  if ( !posts.length ) {
    return {};
  }

  return this.build_data( { posts : posts } );
}

// URL mappings
app.urls = {
  "/?" : "index",
  "/b/(.*)" : "blog_post",
  "/tags/(.*)" : "tags",

  "/styles": { static: "./static/styles" }
};

app.events.after_setup.push( function( response ) {
  // check for new/updated posts every 5 minutes
  require( "zest" ).reactor.setInterval(
    this.models.Blog.sync.bind( this.models.Blog ),
    300000
  );

  // TODO needs conf sorting out first
  // manually fire it once at startup too
  // this.models.Blog.sync();

  return response;
} );

// Don't mess with this, either
exports.app = app.setup( DOC_ROOT );

var conf = app.config( "app" ),
    db = require( "mongodb" ).MongoDB( conf.db.host );
