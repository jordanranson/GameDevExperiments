var lg = {};
	lg.Util = {};

ig.module(
	'levelgen.levelgen'
)
.requires(
	'impact.game'
)
.defines(function(){

lg.Levelgen = ig.Class.extend({
	context: null,
	params: {
		width: 40,
		speed: 5,

		forwardWeight: 100,
		forwardDiminishRate: 0.5,
		turnWeight: 50,
		turnDiminishRate: 0.5,
		branchWeight: 100,
		branchDiminishRate: 0.5,
		numCachedActions: 5,
		exploreRadius: 1,

		deadZones: false,
		deadZoneChance: 0.05,
		deadZoneRange: {
			a: 0.45,
			b: 0.55
		},

		capEnds: true,

		genNodes: true,
		nodePadding: 2,
		nodePaddingMin: 1,
		nodeStraitChance: 0.25,
		nodeCornerChance: 0.45,
		node3wayChance: 0.65,
		node4wayChance: 0.85
	},
	template: new ig.Image( 'media/templates/4square.png' ),

	init: function( context ) {
		this.context = context;
	},

	generateLevel: function( params, template ) {
		params = params ? params : this.params;
		template = template ? lg.Util.processTemplate( this.template ) : undefined;

		var map = lg.Util.generateMap( params, template );
			map = lg.Util.processMap( map, params );

		lg.Util.drawMap( map, this.context );
	},

	drawLevel: function( params, template ) {
		params = params ? params : this.params;
		params.drawSteps = true;
		template = template ? lg.Util.processTemplate( this.template ) : undefined;

		var map = lg.Util.generateMap( params, template, this.context );
	}
});

lg.Branch = ig.Class.extend({
	x: 0,
	y: 0,
	direction: 1,
	pos: [],
	steps: 0,
	radius: 1,
	action: 'forward',
	lastAction: [],
	weights: [ 100, 100, 50 ],
	killCounter: 0,
	alive: true,
	aliveCounter: 0,
	map: [],
	branches: [],

	init: function( x, y, direction, map, branches ) {
		this.x = x;
		this.y = y;
		this.direction = direction;
		this.map = map;
		this.branches = branches;
	},

	getCumulativeWeight: function( action, decay ) {
		var weight = 1;

		for( var i = this.lastAction.length; i > 0; --i ) {
			if( action === this.lastAction[i] ) {
				weight *= decay;
			} else {
				break;
			}
		}

		return weight;
	},

	update: function() {
		if( this.killCounter > 16 ) {
			this.alive = false;
		}

		// determine action
		if( this.steps <= 0 ) {

			// chance to move forward
			if( this.action === 'forward' ) this.weights[0] = 100 * this.getCumulativeWeight( 'forward', 0.5 );

			// chance to turn
			if( this.aliveCounter < 2 ) this.weights[1] = 0;
			else if( this.action === 'turn' && this.lastAction[this.lastAction.length-1] === 'turn' ) 
				this.weights[1] = 50 * this.getCumulativeWeight( 'turn', 0.5 );
			else this.weights[1] = 50;

			// chance to branch
			if( this.aliveCounter < 2 ) this.weights[2] = 0;
			else if( this.action === 'branch' && this.lastAction[this.lastAction.length-1] === 'branch' ) 
				this.weights[2] = 100 * this.getCumulativeWeight( 'branch', 0.5 );
			else this.weights[2] = 100;

			// select action and number of steps
			this.action = swt( lg.Util.weightedRandom( 3, this.weights ), 'forward', 'turn', 'branch' );
			this.steps = 1;
		}

		// carry out action
		if( this.steps > 0 ) {

			// move forward
			if( this.action === 'forward' ) {
				var canMove;
				if( this.direction === 0 ) {
					canMove = lg.Util.check(this.map,this.x,this.y-1-this.radius);
					if( canMove ) this.y--;
				}
				if( this.direction === 1 ) {
					canMove = lg.Util.check(this.map,this.x+1+this.radius,this.y);
					if( canMove ) this.x++;
				}
				if( this.direction === 2 ) {
					canMove = lg.Util.check(this.map,this.x,this.y+1+this.radius);
					if( canMove ) this.y++;
				}
				if( this.direction === 3 ) {
					canMove = lg.Util.check(this.map,this.x-1-this.radius,this.y);
					if( canMove ) this.x--;
				}

				if( canMove ) {
					lg.Util.carve( this.map, this.x, this.y, this.radius );
					this.steps--;
				}
				else {
					this.steps = 0;
				}
			}

			// turn
			if( this.action === 'turn' ) {

				// TODO: favor certain directions

				// check if can turn in a direction
				var canTurn = false;
				var turnChance = Math.random()*3<<0;

				// check if can turn that direction
				if( this.direction === 0 || this.direction === 2 ) {
					if( turnChance === 0 ) {
						canTurn = lg.Util.check(this.map,this.x+1+this.radius,this.y);
						turnChance = 1;
					} 
					else if( turnChance === 1 ) { 
						canTurn = lg.Util.check(this.map,this.x-1-this.radius,this.y);
						turnChance = 3;
					}
					else {
						if( this.direction === 0 ) {
							canTurn = lg.Util.check(this.map,this.x,this.y+1+this.radius);
							turnChance = 2;
						}
					}
				}
				if( this.direction === 1 || this.direction === 3 ) {
					if( turnChance === 0 ) {
						canTurn = lg.Util.check(this.map,this.x,this.y+1+this.radius);
						turnChance = 2;
					} 
					else if( turnChance === 1 ) { 
						canTurn = lg.Util.check(this.map,this.x,this.y-1-this.radius);
						turnChance = 0;
					}
					else {
						if( this.direction === 3 ) {
							canTurn = lg.Util.check(this.map,this.x+1+this.radius,this.y);
							turnChance = 1;
						}
					}
				}

				// can do, turn!
				if( canTurn ) {
					this.direction = turnChance;

					this.action = 'forward';
					this.steps = this.radius+1;

					this.killCounter = 0;
				} else {
					this.killCounter++;
				}
			}

			// branch off
			if( this.action === 'branch' ) {
				var canBranch, pos = [];

				// choose random direction other than current direction and the direction just came from
				var d = this.direction;
				while( d === this.direction && d !== this.direction+2 && d !== this.direction-2 ) d = Math.round( Math.random()*3 );

				// check if space is available
				if( d === 0 ) {
					canBranch = lg.Util.check(this.map,this.x, this.y-1-this.radius);
				}
				if( d === 1 ) {
					canBranch = lg.Util.check(this.map,this.x+1+this.radius, this.y);
				}
				if( d === 2 ) {
					canBranch = lg.Util.check(this.map,this.x, this.y+1+this.radius);
				}
				if( d === 3 ) {
					canBranch = lg.Util.check(this.map,this.x-1-this.radius, this.y);
				}

				if( canBranch ) {
					this.branches.push( new lg.Branch( this.x, this.y, d, this.map, this.branches ) );
				}
				this.steps = 0;
			}
		}

		this.lastAction.push( this.action );
		if( this.lastAction.length > 5 ) this.lastAction.shift();

		this.aliveCounter++;
	}
});	

lg.Util.weightedRandom = function( choices, weight ) {
	var sum = 0;
	for(var i = 0; i < choices; i++ ) {
   		sum += weight[i];
	}

	var rnd = Math.random()*sum;
	for( var i = 0; i < choices; i++ ) {
		if( rnd < weight[i] ) return i;
		rnd -= weight[i];
	}

	return false;
};

lg.Util.processMap = function( map, params ) {
	var newMap = [];
	for( var y = 0; y < map.length; y++ ) {
		newMap[y] = [];
	}

	// create networks
	var tile, n, e, s, w;
	for( var y = 0; y < map.length; y++ ) {
		for( var x = 0; x < map[y].length; x++ ) {
			tile = map[y][x];
			n = map[y-1] ? map[y-1][x] : -1;
			e = map[y][x+1] ? map[y][x+1] : -1;
			s = map[y+1] ? map[y+1][x] : -1;
			w = map[y][x-1] ? map[y][x-1] : -1;

			if( tile === 'X' ) {
					 if( n !== 'X' && e === 'X' && s !== 'X' && w === 'X' ) { newMap[y][x] = '0'; } // h
				else if( n !== 'X' && e === 'X' && s !== 'X' && w !== 'X' ) { newMap[y][x] = params.capEnds?'M':'0'; } // h - cap
				else if( n !== 'X' && e !== 'X' && s !== 'X' && w === 'X' ) { newMap[y][x] = params.capEnds?'M':'0'; } // h - cap
				else if( n === 'X' && e !== 'X' && s === 'X' && w !== 'X' ) { newMap[y][x] = '1'; } // v
				else if( n === 'X' && e !== 'X' && s !== 'X' && w !== 'X' ) { newMap[y][x] = params.capEnds?'M':'1'; } // v - cap
				else if( n !== 'X' && e !== 'X' && s === 'X' && w !== 'X' ) { newMap[y][x] = params.capEnds?'M':'1'; } // v - cap
				else if( n === 'X' && e === 'X' && s !== 'X' && w !== 'X' ) { newMap[y][x] = '2'; } // ne
				else if( n === 'X' && e !== 'X' && s !== 'X' && w === 'X' ) { newMap[y][x] = '3'; } // nw
				else if( n !== 'X' && e === 'X' && s === 'X' && w !== 'X' ) { newMap[y][x] = '4'; } // se
				else if( n !== 'X' && e !== 'X' && s === 'X' && w === 'X' ) { newMap[y][x] = '5'; } // sw
				else if( n === 'X' && e === 'X' && s !== 'X' && w === 'X' ) { newMap[y][x] = '6'; } // hn
				else if( n !== 'X' && e === 'X' && s === 'X' && w === 'X' ) { newMap[y][x] = '7'; } // hs
				else if( n === 'X' && e === 'X' && s === 'X' && w !== 'X' ) { newMap[y][x] = '8'; } // ve
				else if( n === 'X' && e !== 'X' && s === 'X' && w === 'X' ) { newMap[y][x] = '9'; } // vw
				else if( e === 'X' && w === 'X' && n === 'X' && s === 'X' ) { newMap[y][x] = '10'; } // i
				else newMap[y][x] = tile;
			}
			else {
				newMap[y][x] = tile;
			}
		}
	}

	var nodeChance, makeNode, radius;
	if( params.genNodes ) {
		for( var y = 0; y < map.length; y++ ) {
			for( var x = 0; x < map[y].length; x++ ) {
				tile = map[y][x];
				n = map[y-1] ? map[y-1][x] : -1;
				e = map[y][x+1] ? map[y][x+1] : -1;
				s = map[y+1] ? map[y+1][x] : -1;
				w = map[y][x-1] ? map[y][x-1] : -1;

				nodeChance = 0;
				if( tile === 'X' ) {
						 if( n !== 'X' && e === 'X' && s !== 'X' && w === 'X' ) { nodeChance = params.nodeStraitChance; } // h
					else if( n === 'X' && e !== 'X' && s === 'X' && w !== 'X' ) { nodeChance = params.nodeStraitChance; } // v
					else if( n === 'X' && e === 'X' && s !== 'X' && w !== 'X' ) { nodeChance = params.nodeCornerChance; } // ne
					else if( n === 'X' && e !== 'X' && s !== 'X' && w === 'X' ) { nodeChance = params.nodeCornerChance; } // nw
					else if( n !== 'X' && e === 'X' && s === 'X' && w !== 'X' ) { nodeChance = params.nodeCornerChance; } // se
					else if( n !== 'X' && e !== 'X' && s === 'X' && w === 'X' ) { nodeChance = params.nodeCornerChance; } // sw
					else if( n === 'X' && e === 'X' && s !== 'X' && w === 'X' ) { nodeChance = params.node3wayChance; } // hn
					else if( n !== 'X' && e === 'X' && s === 'X' && w === 'X' ) { nodeChance = params.node3wayChance; } // hs
					else if( n === 'X' && e === 'X' && s === 'X' && w !== 'X' ) { nodeChance = params.node3wayChance; } // ve
					else if( n === 'X' && e !== 'X' && s === 'X' && w === 'X' ) { nodeChance = params.node3wayChance; } // vw
					else if( e === 'X' && w === 'X' && n === 'X' && s === 'X' ) { nodeChance = params.node4wayChance; } // i

					if( Math.random() >= 1-nodeChance ) {

						// look for surrounding nodes
						makeNode = true;
						radius = (Math.random()*params.nodePadding<<0) + params.nodePaddingMin;
						for( var j = -radius; j <= radius; j++ ) {
							for( var k = -radius; k <= radius; k++ ) {
								if( newMap[y+j] && newMap[y+j][x+k] && newMap[y+j][x+k] === 'N' ) makeNode = false;
								if( newMap[y+j] && newMap[y+j][x+k] && newMap[y+j][x+k] === 'M' ) makeNode = false;
							}
						}
						
						// do it
						if( makeNode ) {
							newMap[y][x] = 'N';
							lastNode = 0;
						}
					}
				}
			}
		}
	}

	return newMap;
};

lg.Util.generateMap = function( params, template, context ) {
	var map = [];
	var branches = [];

	/* 
		? - unexplored, color: #000
		. - explored, color: #333
		X - carved, color: #fff
		
		0 - horz
		1 - vert
		2 - ne
		3 - nw
		4 - se
		5 - sw
		6 - horz n
		7 - horz s
		8 - vert e
		9 - vert w
		10 - intersection

		N - empty node, color: #ccc
		A - player 1, color: #c00
		B - player 2, color: #0c0
		C - player 3, color: #00c
		D - player 4, color: #cc0
		E - player 5, color: #0cc
		F - player 6, color: #c0c

		! - branch spawn, color: #f0f
		!0 - spawn n, color: #f3f
		!1 - spawn w, color: #f6f
		!2 - spawn s, color: #f9f
		!3 - spawn w, color: #fcf
	*/

	for( var y = 0; y < params.width; y++ ) { 
		map[y] = [];
	}
	for( var y = 0; y < params.width; y++ ) {
		for( var x = 0; x < params.width; x++ ) {
			if( 
				params.deadZones &&
				Math.random() < params.deadZoneChance && 
				y > 2 && 
				x > 2 && 
				(y < params.width*params.deadZoneRange.a || y > params.width*params.deadZoneRange.b) && 
				(x < params.width*params.deadZoneRange.a || x > params.width*params.deadZoneRange.b) && 
				y < params.width-3 && 
				x < params.width-3 
			) {
				map[y][x] = '.';
				map[y+1][x+1] = '.';
				map[y-1][x-1] = '.';
				map[y+1][x-1] = '.';
				map[y-1][x+1] = '.';
			} 
			else if( map[y][x] !== '.' ) {
				map[y][x] = '?';
			}
		}
	}

	// Fill in with template if available
	if( template ) {
		var tile, direction;

		// Go over template and fill in map
		for( var y = 0; y < template.length; y++ ) {
			for( var x = 0; x < template[y].length; x++ ) {
				tile = template[y][x];
				if( tile !== '?' ) {
					map[y][x] = tile;
				}
			}
		}

		// Go over map and replace branch spawns with normal tiles
		// and spawn branches at their locations
		for( var y = 0; y < map.length; y++ ) {
			for( var x = 0; x < map[y].length; x++ ) {
				tile = map[y][x];
				direction = -1;

				// if string contains '!' spawn a branch
				if( !!~tile.indexOf('!') ) {

					// choose direction of branch
					for( var i = 0; i < 4; i++ ) {
						if( !!~tile.indexOf(i) ) {
							direction = i;
							break;
						}
					}

					direction = direction === -1 ? Math.random()*4<<0 : direction;
					lg.Util.carve( map, x, y, 1 );
					branches.push( new lg.Branch( x, y, direction, map, branches ) );
				}
			}
		}
	}

	// Otherwise just start a branch in the middle
	else {
		var start = Math.round( params.width*0.5 );
		lg.Util.carve( map, start, start, 1 );
		branches.push( new lg.Branch( start, start, Math.random()*4<<0, map, branches ) );
	}

	var branch;

	if( !params.drawSteps ) {
		while( branches.length > 0 ) {
			for( var k = 0; k < branches.length; k++ ) {
				branch = branches[k];
				branch.update();

				// remove from array if dead
				if( !branch.alive ) {
					branches.splice( branches.indexOf(branch), 1 );
				}
			}
		}

		return map;
	}

	else {
		var t = setInterval( function() {
			for( var k = 0; k < branches.length; k++ ) {
				branch = branches[k];
				branch.update();

				// remove from array if dead
				if( !branch.alive ) {
					branches.splice( branches.indexOf(branch), 1 );
				}
			}
			lg.Util.drawMap( map, context );

			if( branches.length <= 0 ) {
				clearInterval( t );
				map = lg.Util.processMap( map, params );
				lg.Util.drawMap( map, context );
			}
		}, params.speed );
	}
};

lg.Util.processTemplate = function( image ) {
	var map = [];
	for( var i = 0; i < image.width; i++ ) {
		map[i] = [];
	}

	var cvs = ig.$new( 'Canvas' );
		cvs.width = cvs.height = image.width;

	var ctx = cvs.getContext( '2d' );
		ctx.drawImage( image.data, 0, 0, image.width, image.height );

	var imageData = ctx.getImageData( 0, 0, image.width, image.height );
	var data = imageData.data;

	var r,g,b;
	for (var y = 0; y < image.height; ++y) {
	    for (var x = 0; x < image.width; ++x) {
	        var index = (y * image.width + x) * 4;
	        r = data[index];      // red
	        g = data[++index];    // green
	        b = data[++index];    // blue

	        // map color to tile char
	        if( rgbToHex( r, g, b ) === '000000' ) map[y][x] = '?';
	        else if( rgbToHex( r, g, b ) === '333333' ) map[y][x] = '.';
	        else if( rgbToHex( r, g, b ) === 'ffffff' ) map[y][x] = 'X';

	        else if( rgbToHex( r, g, b ) === 'ff00ff' ) map[y][x] = '!';
	        else if( rgbToHex( r, g, b ) === 'ff33ff' ) map[y][x] = '!0';
	        else if( rgbToHex( r, g, b ) === 'ff66ff' ) map[y][x] = '!1';
	        else if( rgbToHex( r, g, b ) === 'ff99ff' ) map[y][x] = '!2';
	        else if( rgbToHex( r, g, b ) === 'ffccff' ) map[y][x] = '!3';

	        else map[y][x] = '?';
	    }
	}

	return map;
};

lg.Util.check = function( map, x, y, symbol ) {
	var width = map.length;

	if( x < 0 ) return false;
	if( y < 0 ) return false;
	if( x > width ) return false;
	if( y > width ) return false;

	if( map[y] && map[y][x] && map[y][x] === '?' ) return true;
	if( symbol && map[y] && map[y][x] && map[y][x] === symbol ) return true;

	return false;
};

lg.Util.carve = function( map, x, y, radius, value ) {
	value = value ? value : 'X';
	for( var j = -radius; j <= radius; j++ ) {
		for( var k = -radius; k <= radius; k++ ) {
			if( lg.Util.check(map,x+k,y+j) ) map[y+j][x+k] = '.';
		}
	}
	map[y][x] = value;
};

lg.Util.drawMap = function( map, context ) {
	context.fillStyle = '#000';
	context.fillRect( 0, 0, 640, 640 );

	var tile;
	for( var y = 0; y < map.length; y++ ) {
		for( var x = 0; x < map[y].length; x++ ) {
			tile = map[y][x];

			// draw explored area
			if( tile !== '?' ) {
				context.fillStyle = '#12171c';
				context.fillRect( x*16, y*16, 15, 15 );
			}

			// draw network
			context.fillStyle = '#525c6b';
			if( tile === 'X' ) {
				context.fillRect( x*16, y*16, 15, 15 );
			}
			if( tile === '0' ) {
				context.fillRect( x*16, y*16+5, 15, 5 );
			}
			if( tile === '1' ) {
				context.fillRect( x*16+5, y*16, 5, 15 );
			}
			if( tile === '2' ) {
				context.fillRect( x*16+5, y*16+5, 10, 5 );
				context.fillRect( x*16+5, y*16, 5, 10 );
			}
			if( tile === '3' ) {
				context.fillRect( x*16, y*16+5, 10, 5 );
				context.fillRect( x*16+5, y*16, 5, 10 );
			}
			if( tile === '4' ) {
				context.fillRect( x*16+5, y*16+5, 10, 5 );
				context.fillRect( x*16+5, y*16+5, 5, 10 );
			}
			if( tile === '5' ) {
				context.fillRect( x*16, y*16+5, 10, 5 );
				context.fillRect( x*16+5, y*16+5, 5, 10 );
			}
			if( tile === '6' ) {
				context.fillRect( x*16, y*16+5, 15, 5 );
				context.fillRect( x*16+5, y*16, 5, 10 );
			}
			if( tile === '7' ) {
				context.fillRect( x*16, y*16+5, 15, 5 );
				context.fillRect( x*16+5, y*16+5, 5, 10 );
			}
			if( tile === '8' ) {
				context.fillRect( x*16+5, y*16+5, 10, 5 );
				context.fillRect( x*16+5, y*16, 5, 15 );
			}
			if( tile === '9' ) {
				context.fillRect( x*16, y*16+5, 10, 5 );
				context.fillRect( x*16+5, y*16, 5, 15 );
			}
			if( tile === '10' ) {
				context.fillRect( x*16, y*16+5, 15, 5 );
				context.fillRect( x*16+5, y*16, 5, 15 );
			}

			// draw nodes
			if( tile === 'N' ) {
				context.fillStyle = '#0ff';
				context.fillRect( x*16, y*16, 15, 15 );
			}
			if( tile === 'M' ) {
				context.fillStyle = '#ff0';
				context.fillRect( x*16, y*16, 15, 15 );
			}

		}
	}
};

lg.Loader = ig.Loader.extend({
	end: function() {
		if( this.done ) { return; }
		
		clearInterval( this._intervalId );
		this.done = true;
		ig.system.clear( '#000' );
		ig.game = new (this.gameClass)();
	},
	
	loadResource: function( res ) {
		if( res instanceof ig.Sound ) {
			this._unloaded.erase( res.path );
		}
		else {
			this.parent( res );
		}
	}
});

function swt( i ) { 
	return arguments[++i];
}

function componentToHex( c ) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex( r, g, b ) {
    return String( componentToHex(r) + componentToHex(g) + componentToHex(b) ).toLowerCase();
}

});