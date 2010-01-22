// Don't mess these first few lines
const juice = require('juice');

// temporary Template hackery
delete require( "Template" ).Template.Stash.PRIVATE;

var app = new juice.Application( module ),
    conf, db;

app.models.Posts = {
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
   * Posts.by_tags( tags, [ union ] ) -> Array
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
   * Posts.recent( [count] ) -> Array
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
   * Posts.sync()
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

    fs_posts.forEach( function( p ) {
      try {
        // use filename as id
        var post = { _id : p },
            db_post = db.findOne( conf.db.collection, post );

        var post_path = path + "/" + post._id;
        post.updated = fs.lastModified( post_path );

        // check last modified times to see if we need to update
        if ( db_post && db_post.updated >= post.updated ) {
          return undefined;
        }

        // parse the new/updated content
        var raw = fs.rawOpen( post_path, "r" ).readWhole(),
            md = new ( markdown.Markdown )( "Maruku" ),
            tree = md.toTree( raw ),
            attr = extract_attr( tree ),
            i = attr ? 1 : 0;

        // find the first HR (if there is one) to split content
        while ( ++i < tree.length ) {
          if ( tree[ i ][ 0 ] === "hr" ) {
            // remove the HR from the tree
            tree.splice( i, 1 );
            // parse the lead content
            post.short = markdown.toHTML( tree.slice( 0, i ) );
            break;
          }
        }

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
      catch ( e ) {
        print( "  ERROR parsing", post._id );
        print( e.toSource() );
      }

      return undefined;
    } );

    // delete any posts we didn't come across (i.e. the files have been deleted)
    print( "  removing other posts" );
    db.remove( conf.db.collection, { _id : { $nin : fs_posts } } );
  }
};

app.models.Tags = {
  /**
   * Tags.all() -> Object
   *
   * Get a list of all tags used on any post, with counts, e.g.:
   *     { games : 1, books : 8, music : 3 }
   */
  all : function() {
    var cursor = db.find( conf.db.collection, { tags : { $exists: true } }, { tags : 1 } ),
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

// TODO this should move to a view class
// used to add common data used on every page (in footers, sidebars etc)
app.build_data = function( data ) {
  data.tags = this.models.Tags.all();
  data.recent = this.models.Posts.recent( 5 );
  return data;
}

// home page, nothing but a list of recent posts
app.controllers.index = function() {
  // all the interesting data is available through build_data anyway
  return this.build_data( {} );
}

// single blog post by id, 404 if not found in the database
app.controllers.blog_post = function( id ) {
  var post = this.models.Posts.by_id( id );

  // return a 404 if it doesn't exist
  if ( !post ) {
    return {};
  }

  return this.build_data( { post : post } );
}

// list all posts with the given tag
app.controllers.tags = function( tag ) {
  var posts = this.models.Posts.by_tags( [ tag ] );

  // return a 404 if none were found
  if ( !posts.length ) {
    return {};
  }

  return this.build_data( {
    tag : tag,
    posts : posts
  } );
}

// URL mappings
app.urls = {
  "/?" : "index",
  "/tags/(.*)" : "tags",

  "/styles": { static: "./static/styles" },
  "/scripts": { static: "./static/scripts" },

  // declare this last as it's a catch all
  "/(.*)" : "blog_post"
};

app.events.after_setup.push( function( response ) {
  conf = this.config.app;
  db = require( "mongodb" ).MongoDB( conf.db.host );

  // modify the template path
  if ( conf.templates ) {
    this.templatePath.unshift( conf.templates );
  }

  // check for new/updated posts every 5 minutes
  require( "zest" ).reactor.setInterval(
    this.models.Posts.sync.bind( this.models.Posts ),
    300000
  );

  // manually fire it once at startup too
  this.models.Posts.sync();

  return response;
} );

app.helpers.short_date = function( date ) {
  var months = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

  return months[ date.getMonth() ] + " " + date.getDate();
}

app.helpers.long_date = function( date ) {
  var days = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ],
      months = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

  return days[ date.getDay() ] + " " + date.getDate() + " "
       + months[ date.getMonth() ] + " " + date.getFullYear();
}

// Don't mess with this, either
exports.app = app.asJSGI();
