//
// cgl.js
//

var cgl_canvas;

// A more efficient array of bits using Javascript numbers.
// Javascript numbers are 64-bit floating point which have a 51-bit mantissa.
// However, bitwise operations on those numbers convert them to 32-bit integers and back.
function cgl_bit_array(nbits) {
	this.nbits = nbits;
	this.nints = ((nbits + 31) / 32) | 0;
	this.data = new Array();
	for (var i = 0; i < this.nints; i++) {
		this.data.push(0);
	}
}
cgl_bit_array.prototype.get = function(idx) {
	var intidx = idx >>> 5;
	var inner_bit = idx % 32;
	return this.data[intidx] & (1 << inner_bit);
}
cgl_bit_array.prototype.set = function(idx, set) {
	var intidx = idx >>> 5;
	var inner_bit = idx % 32;
	if (set) {
		this.data[intidx] = this.data[intidx] | (1 << inner_bit);
	} else {
		this.data[intidx] = this.data[intidx] & ~(1 << inner_bit);
	}
}
cgl_bit_array.prototype.clear = function() {
	for (var i = 0; i < this.data.length; i++) {
		this.data[i] = 0;
	}
}
cgl_bit_array.prototype.andMask = function(mask) {
	var limit = this.nints < mask.nints ? this.nints : mask.nints;
	for (var i = 0; i < limit; i++) {
		this.data[i] = this.data[i] & mask.data[i];
	}
}
cgl_bit_array.prototype.orMask = function(mask) {
	var limit = this.nints < mask.nints ? this.nints : mask.nints;
	for (var i = 0; i < limit; i++) {
		this.data[i] = this.data[i] | mask.data[i];
	}
}
cgl_bit_array.prototype.invert = function() {
	for (var i = 0; i < this.nints; i++) {
		this.data[i] = ~this.data[i];
	}
}

// Game of Life prototype
function cgl_game(ncols, nrows, data) {
	if (ncols < 2 || nrows < 2) throw "cgl game too small";
	if (!data) {
		// No initial position supplied. Generate an empty one.
		data = new cgl_bit_array(ncols * nrows);
	}
	else if (data == "random") {
		// Generate a random initial position.
		data = new cgl_bit_array(ncols * nrows);
		for (var i = 0; i < data.nints; i++) {
			data.data[i] = Math.floor(Math.random() * 0x100000000);
		}
	}
	else if (data.nbits != ncols * nrows) throw "cgl game data size mismatch";
	this.ncols = ncols;
	this.nrows = nrows;
	this.data = data;
	this.deaths = new cgl_bit_array(data.nbits);
	this.births = new cgl_bit_array(data.nbits);
	this.staged = new cgl_bit_array(data.nbits);
}
cgl_game.prototype.setCell = function(rowidx, colidx, set) {
	if (set == undefined) set = 1;
	this.data.set(rowidx * this.ncols + colidx, set);
}
cgl_game.prototype.stageCell = function(rowidx, colidx, stage) {
	if (stage == undefined) stage = true;
	this.staged.set(rowidx * this.ncols + colidx, stage);
}
cgl_game.prototype.hasStaged = function() {
	for (var i = 0; i < this.staged.nints; i++) {
		if (this.staged.data[i]) return true;
	}
	return false;
}
cgl_game.prototype.applyStage = function() {
	this.data.orMask(this.staged);
	this.staged.clear();
}
cgl_game.prototype.clear = function() {
	this.data.clear();
	this.deaths.clear();
	this.births.clear();
	this.staged.clear();
}
cgl_game.prototype.handleNeighborCount = function(bi, nc) {
	if (nc < 2) { // Starvation
		if (this.data.get(bi)) this.deaths.set(bi, 1);
	}
	else if (nc == 3) {
		if (!this.data.get(bi)) this.births.set(bi, 1); // New birth
	}
	else if (nc > 3) { // Overpopulation
		if (this.data.get(bi)) this.deaths.set(bi, 1);
	}
}
cgl_game.prototype.countNeighbors = function() {
	var NEcorner = this.ncols - 1;
	var SWcorner = this.ncols * (this.nrows - 1);
	var SEcorner = this.ncols * this.nrows - 1;
	// NW corner
	var nc = 0;
	if (this.data.get(1)) nc++;
	if (this.data.get(this.ncols)) nc++;
	if (this.data.get(this.ncols + 1)) nc++;
	// Wraps
	if (this.data.get(SEcorner)) nc++;
	if (this.data.get(SWcorner)) nc++;
	if (this.data.get(SWcorner + 1)) nc++;
	if (this.data.get(NEcorner)) nc++;
	if (this.data.get(NEcorner + this.ncols)) nc++;
	this.handleNeighborCount(0, nc);
	// N border
	var bi;
	for (bi = 1; bi < this.ncols - 1; bi++) {
		nc = 0;
		if (this.data.get(bi - 1)) nc++;
		if (this.data.get(bi + 1)) nc++;
		if (this.data.get(bi + this.ncols - 1)) nc++;
		if (this.data.get(bi + this.ncols)) nc++;
		if (this.data.get(bi + this.ncols + 1)) nc++;
		// Wraps
		if (this.data.get(SWcorner + bi)) nc++;
		if (this.data.get(SWcorner + bi - 1)) nc++;
		if (this.data.get(SWcorner + bi + 1)) nc++;
		this.handleNeighborCount(bi, nc);
	}
	// NE corner
	nc = 0;
	if (this.data.get(bi - 1)) nc++;
	if (this.data.get(bi + this.ncols - 1)) nc++;
	if (this.data.get(bi + this.ncols)) nc++;
	// Wraps
	if (this.data.get(SWcorner)) nc++;
	if (this.data.get(SEcorner)) nc++;
	if (this.data.get(SEcorner - 1)) nc++;
	if (this.data.get(0)) nc++;
	if (this.data.get(this.ncols)) nc++;
	this.handleNeighborCount(bi, nc);
	bi++;
	// Middle rows
	var ri;
	for (ri = 1; ri < this.nrows - 1; ri++) {
		// W border
		nc = 0;
		if (this.data.get(bi - this.ncols)) nc++;
		if (this.data.get(bi - this.ncols + 1)) nc++;
		if (this.data.get(bi + 1)) nc++;
		if (this.data.get(bi + this.ncols)) nc++;
		if (this.data.get(bi + this.ncols + 1)) nc++;
		// Wraps
		if (this.data.get(bi + this.ncols - 1)) nc++;
		if (this.data.get(bi + 2 * this.ncols - 1)) nc++;
		if (this.data.get(bi - 1)) nc++;
		this.handleNeighborCount(bi, nc);
		bi++;
		// Middle columns
		var ci;
		for (ci = 1; ci < this.ncols - 1; ci++) {
			nc = 0;
			if (this.data.get(bi - this.ncols)) nc++;
			if (this.data.get(bi - this.ncols + 1)) nc++;
			if (this.data.get(bi + 1)) nc++;
			if (this.data.get(bi + this.ncols + 1)) nc++;
			if (this.data.get(bi + this.ncols)) nc++;
			// Wraps
			if (this.data.get(bi + this.ncols - 1)) nc++;
			if (this.data.get(bi - 1)) nc++;
			if (this.data.get(bi - this.ncols - 1)) nc++;
			this.handleNeighborCount(bi, nc);
			bi++;
		}
		// E border
		nc = 0;
		if (this.data.get(bi - this.ncols)) nc++;
		if (this.data.get(bi - this.ncols - 1)) nc++;
		if (this.data.get(bi - 1)) nc++;
		if (this.data.get(bi + this.ncols)) nc++;
		if (this.data.get(bi + this.ncols - 1)) nc++;
		// Wraps
		if (this.data.get(bi - this.ncols + 1)) nc++;
		if (this.data.get(bi + 1)) nc++;
		if (this.data.get(bi - 2 * this.ncols + 1)) nc++;
		this.handleNeighborCount(bi, nc);
		bi++;
	}
	// SW corner
	var nc = 0;
	if (this.data.get(bi + 1)) nc++;
	if (this.data.get(bi - this.ncols)) nc++;
	if (this.data.get(bi - this.ncols + 1)) nc++;
	// Wraps
	if (this.data.get(NEcorner)) nc++;
	if (this.data.get(0)) nc++;
	if (this.data.get(1)) nc++;
	if (this.data.get(SEcorner)) nc++;
	if (this.data.get(SEcorner - this.ncols)) nc++;
	this.handleNeighborCount(bi, nc);
	bi++;
	// S border
	var ci
	for (ci = 1; ci < this.ncols - 1; ci++) {
		nc = 0;
		if (this.data.get(bi - 1)) nc++;
		if (this.data.get(bi + 1)) nc++;
		if (this.data.get(bi - this.ncols - 1)) nc++;
		if (this.data.get(bi - this.ncols)) nc++;
		if (this.data.get(bi - this.ncols + 1)) nc++;
		// Wraps
		if (this.data.get(ci)) nc++;
		if (this.data.get(ci - 1)) nc++;
		if (this.data.get(ci + 1)) nc++;
		this.handleNeighborCount(bi, nc);
		bi++;
	}
	// SE corner
	nc = 0;
	if (this.data.get(bi - 1)) nc++;
	if (this.data.get(bi - this.ncols - 1)) nc++;
	if (this.data.get(bi - this.ncols)) nc++;
	// Wraps
	if (this.data.get(0)) nc++;
	if (this.data.get(NEcorner)) nc++;
	if (this.data.get(NEcorner - 1)) nc++;
	if (this.data.get(SWcorner)) nc++;
	if (this.data.get(SWcorner - this.ncols)) nc++;
	this.handleNeighborCount(bi, nc);
	bi++;
}
cgl_game.prototype.step = function() {
	this.deaths.clear();
	this.births.clear();
	this.countNeighbors();
	this.deaths.invert();
	this.data.andMask(this.deaths);
	this.deaths.invert();
	this.data.orMask(this.births);
}
cgl_game.prototype.drawOnCanvas = function(canvas, options) {
	// Get sizes
	var cellSize = options.cellSize;
	var cellBorderSize = options.cellBorderSize;
	var visibleRows = this.nrows - options.hiddenRows;
	var visibleCols = this.ncols - options.hiddenCols;
	// Get context
	var ctx = canvas.getContext("2d");
	ctx.save();
	// Translate context so that first row and column are partially clipped.
	// This suggests continuation of the playing field.
	ctx.translate(-cellSize / 2, -cellSize / 2);
	// Clear drawing area
	ctx.fillStyle = options.emptyFillStyle;
	ctx.fillRect(0, 0, visibleCols * cellSize, visibleRows * cellSize);
	// Draw grid rows
	ctx.fillStyle = options.borderFillStyle;
	for (var ri = 0; ri <= visibleRows; ri++) {
		var y = ri * cellSize - 1;
		ctx.fillRect(0, y, visibleCols * cellSize, cellBorderSize * 2);
	}
	// Draw grid columns
	for (var ci = 0; ci <= visibleCols; ci++) {
		var x = ci * cellSize - 1;
		ctx.fillRect(x, 0, cellBorderSize * 2, visibleRows * cellSize);
	}
	// Draw filled cells in each visible row
	ctx.fillStyle = options.cellFillStyle;
	var cellDrawSize = cellSize - 2 * cellBorderSize;
	for (var ri = 0; ri < visibleRows; ri++) {
		// Draw each cell in the row
		for (var ci = 0; ci < visibleCols; ci++) {
			var bi = ri * this.ncols + ci;
			var fillStyle = '';
			if (this.staged.get(bi)) { // Draw staged cells
				fillStyle = options.stagedFillStyle;
			}
			else if (options.birthFillStyle && this.births.get(bi)) { // Draw newly born cells
				fillStyle = options.birthFillStyle;
			}
			else if (this.data.get(bi)) { // Draw live cells
				fillStyle = options.cellFillStyle;
			}
			else if (options.deathFillStyle && this.deaths.get(bi)) { // Draw cells that died
				fillStyle = options.deathFillStyle;
			}
			if (fillStyle) {
				ctx.fillStyle = fillStyle;
				ctx.fillRect(
					cellSize * ci + cellBorderSize,
					cellSize * ri + cellBorderSize,
					cellDrawSize,
					cellDrawSize
				);
			}
		}
	}
	ctx.restore();
}

var game;
var cgl_options = {
	cellSize : 32,
	cellBorderSize : 1,
	cellFillStyle : "black",
	emptyFillStyle : "#e5e5e5",
	borderFillStyle : "white",
	deathFillStyle : "",
	birthFillStyle : "",
	stagedFillStyle : "blue",
	hiddenRows : 4,
	hiddenCols : 4,
	timestep : 500,
	paused : false,
};
var cgl_tick;
var cgl_ctrl_tick;
var cgl_fade_delay = 1500;
var cgl_mouse_in_controls = false;
var cgl_mouse_down = 0;

function cgl_resize_game() {
	// Compute best number of visible rows and columns
	var visRows = Math.ceil(cgl_canvas.height / cgl_options.cellSize) + 1;
	var visCols = Math.ceil(cgl_canvas.width / cgl_options.cellSize) + 1;
	// Compute actual number of rows and columns
	var actRows = visRows + cgl_options.hiddenRows;
	var actCols = visCols + cgl_options.hiddenCols;
	if (game && actRows == game.nrows && actCols == game.ncols) {
		// No resize necessary
		return;
	}
	// Create a new random game
	game = new cgl_game(actCols, actRows, "random");
	// Step the game once
	game.step();
}
// Called when window resizes
function cgl_resize_canvas() {
	// Resize canvas
	cgl_canvas.width = window.innerWidth;
	cgl_canvas.height = window.innerHeight;
	// Resize game
	cgl_resize_game();
	// Redraw game
	game.drawOnCanvas(cgl_canvas, cgl_options);
}
function cgl_step_game() {
	if (game.hasStaged()) {
		game.applyStage();
	} else {
		game.step();
	}
	game.drawOnCanvas(cgl_canvas, cgl_options);
}


// Called on body load
function cgl_main() {
	// Set up canvas and create game
	cgl_canvas = document.getElementById("cgl_canvas");
	cgl_resize_canvas();
	window.addEventListener("resize", cgl_resize_canvas);
	// Detect mouse movements
	window.addEventListener("mousemove", cgl_mouse_move);
	var controls = document.getElementsByClassName("cgl_controls_container");
	for (var i = 0; i < controls.length; i++) {
		var control = controls[i];
		control.addEventListener("mouseenter", cgl_mouse_enter_controls);
		control.addEventListener("mouseleave", cgl_mouse_leave_controls);
	}
	window.addEventListener("mousedown", cgl_mousedown);
	window.addEventListener("mouseup", cgl_mouseup);
	document.body.oncontextmenu = function() { return false; };
	// Start control fade timer
	cgl_ctrl_tick = window.setTimeout(cgl_fade_controls, cgl_fade_delay);
	// Start game ticking
	cgl_tick = window.setInterval(cgl_step_game, cgl_options.timestep);
}
function cgl_stage_cell_at(x, y, stage) {
	// Compute clicked cell
	var col = Math.floor((x + cgl_options.cellSize / 2) / cgl_options.cellSize);
	var row = Math.floor((y + cgl_options.cellSize / 2) / cgl_options.cellSize);
	// Stage the clicked cell
	game.stageCell(row, col, stage);
}
function cgl_mousedown(e) {
	// Ignore mouse down in controls
	if (cgl_mouse_in_controls) {
		return false;
	}
	cgl_mouse_down = true;
	// Pause the game
	if (!cgl_options.paused) cgl_pause();
	// Stage the clicked cell
	cgl_stage_cell_at(e.x, e.y, e.button != 2);
	game.drawOnCanvas(cgl_canvas, cgl_options);
	return false;
}
function cgl_mouseup() {
	cgl_mouse_down = false;
}
// Fades out the controls
function cgl_fade_controls() {
	if (cgl_mouse_in_controls) return; // Do not fade when mouse is in controls
	var controls_containers = document.getElementsByClassName("cgl_controls_container");
	for (var i = 0; i < controls_containers.length; i++) {
		var container = controls_containers[i];
		container.style.transitionDuration = "2s";
		container.style.opacity = "0%";
	}
	// Hide cursor
	document.body.style.cursor = "none";
}
// Shows the controls
function cgl_show_controls() {
	// Show mouse
	document.body.style.cursor = "";
	// Show controls
	var controls_containers = document.getElementsByClassName("cgl_controls_container");
	for (var i = 0; i < controls_containers.length; i++) {
		var container = controls_containers[i];
		container.style.transitionDuration = "";
		container.style.opacity = "100%";
	}
}
function cgl_mouse_enter_controls() {
	cgl_mouse_in_controls = true;
}
function cgl_mouse_leave_controls() {
	cgl_mouse_in_controls = false;
}
// Called when the user moves the mouse
function cgl_mouse_move(e) {
	if (cgl_mouse_down) { // Mouse is dragged over canvas
		cgl_stage_cell_at(e.x, e.y);
		game.drawOnCanvas(cgl_canvas, cgl_options);
	}
	// Show controls
	cgl_show_controls();
	// Reset fade timeout
	window.clearTimeout(cgl_ctrl_tick);
	cgl_ctrl_tick = window.setTimeout(cgl_fade_controls, cgl_fade_delay);
}
// Called when the user clicks the pause button
function cgl_pause() {
	cgl_options.paused = !cgl_options.paused;
	if (cgl_options.paused) {
		window.clearInterval(cgl_tick);
		document.getElementById("cgl_pause").children[0].src = "img/play.png"
	} else {
		cgl_step_game();
		cgl_tick = window.setInterval(cgl_step_game, cgl_options.timestep);
		document.getElementById("cgl_pause").children[0].src = "img/pause.png"
	}
}
// Called when the user clicks the reset button
function cgl_reset() {
	game = new cgl_game(game.ncols, game.nrows, "random");
	cgl_step_game();
	if (!cgl_options.paused) {
		window.clearInterval(cgl_tick);
		cgl_tick = window.setInterval(cgl_step_game, cgl_options.timestep);
	}
}
// Called when the user clicks the erase button
function cgl_erase() {
	game.clear();
	game.drawOnCanvas(cgl_canvas, cgl_options);
	if (!cgl_options.paused) {
		cgl_pause();
	}
}
