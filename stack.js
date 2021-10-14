


"use strict";

window.focus(); // Capture keys right away (by default focus is on editor)

var camera, scene, renderer; // ThreeJS globals

var world; // CannonJs world

var lastTime; // Last timestamp of animation

var stack; // Parts that stay solid on top of each other

var overhangs; // Overhanging parts that fall down

var boxHeight = 1; // Height of each layer

var originalBoxSize = 3; // Original width and height of a box

var autopilot;
var gameEnded;
var robotPrecision; // Determines how precise the game is on autopilot

var scoreElement = document.getElementById("score");
var instructionsElement = document.getElementById("instructions");
var resultsElement = document.getElementById("results");
var canvasWidth=800;
var canvasHeight=480;

init(); // Determines how precise the game is on autopilot

function setRobotPrecision() {
  robotPrecision = Math.random() * 1 - 0.5;
}

function init() {
  autopilot = true;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];
  setRobotPrecision(); // Initialize CannonJS

  world = new CANNON.World();
  world.gravity.set(0, -10, 0); // Gravity pulls things down

  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40; // Initialize ThreeJs

  var canvas = document.getElementById("canvasDiv");

  //var aspect = window.innerWidth / window.innerHeight;
  var aspect = canvasWidth / canvasHeight;
  var width = 10;
  var height = width / aspect;
  camera = new THREE.OrthographicCamera(width / -2, // left
  width / 2, // right
  height / 2, // top
  height / -2, // bottom
  0, // near plane
  100 // far plane
  );

  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);
  scene = new THREE.Scene(); // Foundation

  addLayer(0, 0, originalBoxSize, originalBoxSize); // First layer

  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x"); // Set up lights

  var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 0);
  scene.add(dirLight); // Set up renderer

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setSize(canvasWidth, canvasHeight);
  renderer.setAnimationLoop(animation);
  canvas.appendChild(renderer.domElement);

  if (autopilot) instructionsElement.style.display = "flex";

}

function startGame() {
  autopilot = false;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];
  if (instructionsElement) instructionsElement.style.display = "none";
  if (resultsElement) resultsElement.style.display = "none";
  if (scoreElement) scoreElement.innerText = 0;

  if (world) {
    // Remove every object from world
    while (world.bodies.length > 0) {
      world.remove(world.bodies[0]);
    }
  }



  if (scene) {

	var flag=true;
	while(flag){

		var length=scene.children.length;
		var c="";
		for(var i=0; i<length; i++){
			c= scene.children[i];
			if(c.type=="Mesh"){
				break;
			}
			else{
				c="";
			}
		}
		if(c==""){
			flag=false;
		}
		if(c!=""){
			scene.remove(c);
			c="";
		}

	}

    addLayer(0, 0, originalBoxSize, originalBoxSize); // First layer
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");
  }

  if (camera) {
    // Reset camera positions
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);
  }
}

function addLayer(x, z, width, depth, direction) {
  var y = boxHeight * stack.length; // Add the new box one layer higher

  var layer = generateBox(x, y, z, width, depth, false);
  layer.direction = direction;
  stack.push(layer);
}

function addOverhang(x, z, width, depth) {
  var y = boxHeight * (stack.length - 1); // Add the new box one the same layer

  var overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}


function generateBox(x, y, z, width, depth, falls) {
  // ThreeJS
  var geometry = new THREE.BoxGeometry(width, boxHeight, depth);
  var color = new THREE.Color("hsl(".concat(30 + stack.length * 4, ", 100%, 50%)"));
  var material = new THREE.MeshLambertMaterial({
    color: color
  });
  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh); // CannonJS

  var shape = new CANNON.Box(new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2));
  var mass = falls ? 5 : 0; // If it shouldn't fall then setting the mass to zero will keep it stationary

  mass *= width / originalBoxSize; // Reduce mass proportionately by size

  mass *= depth / originalBoxSize; // Reduce mass proportionately by size

  var body = new CANNON.Body({
    mass: mass,
    shape: shape
  });
  body.position.set(x, y, z);
  world.addBody(body);
  return {
    threejs: mesh,
    cannonjs: body,
    width: width,
    depth: depth
  };
}

function cutBox(topLayer, overlap, size, delta) {
  var direction = topLayer.direction;
  var newWidth = direction == "x" ? overlap : topLayer.width;
  var newDepth = direction == "z" ? overlap : topLayer.depth; // Update metadata

  topLayer.width = newWidth;
  topLayer.depth = newDepth; // Update ThreeJS model

  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2; // Update CannonJS model

  topLayer.cannonjs.position[direction] -= delta / 2; // Replace shape to a smaller one (in CannonJS you can't simply just scale a shape)

  var shape = new CANNON.Box(new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2));
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);
}

window.addEventListener("mousedown", eventHandler);
window.addEventListener("touchstart", eventHandler);
window.addEventListener("keydown", function (event) {
  if (event.key == " ") {
    event.preventDefault();
    eventHandler();
    return;
  }
});

function eventHandler() {
  splitBlockAndAddNextOneIfOverlaps();
}

function splitBlockAndAddNextOneIfOverlaps() {
  if (gameEnded) return;
  var topLayer = stack[stack.length - 1];
  var previousLayer = stack[stack.length - 2];
  var direction = topLayer.direction;
  var size = direction == "x" ? topLayer.width : topLayer.depth;
  var delta = topLayer.threejs.position[direction] - previousLayer.threejs.position[direction];
  var overhangSize = Math.abs(delta);
  var overlap = size - overhangSize;

  if (overlap > 0) {
    cutBox(topLayer, overlap, size, delta); // Overhang

    var overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
    var overhangX = direction == "x" ? topLayer.threejs.position.x + overhangShift : topLayer.threejs.position.x;
    var overhangZ = direction == "z" ? topLayer.threejs.position.z + overhangShift : topLayer.threejs.position.z;
    var overhangWidth = direction == "x" ? overhangSize : topLayer.width;
    var overhangDepth = direction == "z" ? overhangSize : topLayer.depth;
    addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth); // Next layer

    var nextX = direction == "x" ? topLayer.threejs.position.x : -10;
    var nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
    var newWidth = topLayer.width; // New layer has the same size as the cut top layer

    var newDepth = topLayer.depth; // New layer has the same size as the cut top layer

    var nextDirection = direction == "x" ? "z" : "x";
    if (scoreElement) scoreElement.innerText = stack.length - 1;
    addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
  } else {
    missedTheSpot();
  }
}

function start(){
    startGame();
}

function logging(token,surveyID,URL){
}

function missedTheSpot() {
  var topLayer = stack[stack.length - 1]; // Turn to top layer into an overhang and let it fall down

  addOverhang(topLayer.threejs.position.x, topLayer.threejs.position.z, topLayer.width, topLayer.depth);
  world.remove(topLayer.cannonjs);
  scene.remove(topLayer.threejs);
  gameEnded = true;
  if (resultsElement && !autopilot) resultsElement.style.display = "flex";
  if(!autopilot) endGame(stack.length-2);
}

function animation(time) {
  if (lastTime) {
    var timePassed = time - lastTime;
    var sp = 0.012;
    var topLayer = stack[stack.length - 1];
    var previousLayer = stack[stack.length - 2]; // The top level box should move if the game has not ended AND
    // it's either NOT in autopilot or it is in autopilot and the box did not yet reach the robot position

    var boxShouldMove = !gameEnded && (!autopilot || autopilot && topLayer.threejs.position[topLayer.direction] < previousLayer.threejs.position[topLayer.direction] + robotPrecision);

    if (boxShouldMove) {
      // Keep the position visible on UI and the position in the model in sync
      topLayer.threejs.position[topLayer.direction] += sp * timePassed;
      topLayer.cannonjs.position[topLayer.direction] += sp * timePassed;

      if (topLayer.threejs.position[topLayer.direction] > 10) {
        missedTheSpot();
      }
    } else {
      // If it shouldn't move then is it because the autopilot reached the correct position?
      // Because if so then next level is coming
      if (autopilot) {
        splitBlockAndAddNextOneIfOverlaps();
        setRobotPrecision();
      }
    } // 4 is the initial camera height


    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
      camera.position.y += sp * timePassed;
    }

    updatePhysics(timePassed);
    renderer.render(scene, camera);
  }

  lastTime = time;
}

function updatePhysics(timePassed) {
  world.step(timePassed / 1000); // Step the physics world
  // Copy coordinates from Cannon.js to Three.js

  overhangs.forEach(function (element) {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}