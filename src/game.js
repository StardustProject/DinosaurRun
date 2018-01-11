var WRGame = function () {

	var ACCEL = 2000;
	var MAX_SPEED_ACCEL = 70;
	var START_MAX_SPEED = 1500;
	var FINAL_MAX_SPEED = 7000;
	var SIDE_ACCEL = 500;
	var MAX_SIDE_SPEED = 4000;
	var TREE_COLS = [0x466310, 0x355B4B, 0x449469];
	var TREE_COUNT = 10;
	var FLOOR_RES = 20;
	var FLOOR_YPOS = -300;
	var FLOOR_THICKNESS = 300;

	var stepCount = 0;
	var moveSpeed = 0; //z方向移动速度
	var maxSpeed; //速度随时间的推移增大
	var slideSpeed = 0;
	var sliding = false;

	var rightDown = false;
	var leftDown = false;
	var playing = false;
	var acceptInput = true;
	var clock;

	var trees = [];

	var noiseScale = 3;
	var noiseSeed = Math.random() * 100;

	var monster;
	var mixers = [];
	var monsterGroup;
	var moverGroup;
	var presentGroup;
	var floorGeometry;
	var treeMaterials;
	var trunkMaterial;
	var treeGeom;
	var trunkGeom;

	var snoise = new ImprovedNoise();

	function init() {

		clock = new THREE.Clock();

		//灯光

		//户外光照 HemisphereLight(skyColorHex, groundColorHex, intensity)
		var hemisphereLight = new THREE.HemisphereLight(0x30317, 0xBBBBBB, 0.6);
		WRMain.getScene().add(hemisphereLight);
		hemisphereLight.position.y = 300;

		//中心光（点光源）
		var centerLight = new THREE.PointLight(0xBBBBBB, 0.8, 4500);
		WRMain.getScene().add(centerLight);
		centerLight.position.z = WRConfig.FLOOR_DEPTH / 4;
		centerLight.position.y = 500;
		//前向光（点光源）
		var frontLight = new THREE.PointLight(0xBBBBBB, 1, 2500);
		WRMain.getScene().add(frontLight);
		frontLight.position.z = WRConfig.FLOOR_DEPTH / 2;

		moverGroup = new THREE.Object3D();
		WRMain.getScene().add(moverGroup);

		//构建地面
		var floorGroup = new THREE.Object3D();

		var floorMaterial = new THREE.MeshLambertMaterial({
			color: 0xCCCCCC, //diffuse
			emissive: 0x996600,
			shading: THREE.FlatShading,
			side: THREE.DoubleSide,
		});

		floorGeometry = new THREE.PlaneGeometry(WRConfig.FLOOR_WIDTH + 1200, WRConfig.FLOOR_DEPTH, FLOOR_RES, FLOOR_RES);
		var floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
		floorGroup.add(floorMesh);
		moverGroup.add(floorGroup);
		floorMesh.rotation.x = Math.PI / 2;
		//floorMesh.rotation.z = Math.PI/2;
		floorGroup.position.y = FLOOR_YPOS;
		moverGroup.position.z = -WRConfig.MOVE_STEP;
		floorGroup.position.z = 500;

		/*
		 * 陈龙江
		 * 2018/1/10
		 * 修改树的模型
		 */
		//make trees
		var i;
		treeMaterials = [];

		for (i = 0; i < TREE_COLS.length; i++) {

			var treeMaterial = new THREE.MeshLambertMaterial({
				color: TREE_COLS[i],
				shading: THREE.FlatShading,
				depthTest: true,
			});
			treeMaterials.push(treeMaterial);
		}

		trunkMaterial = new THREE.MeshLambertMaterial({
			color: 0x330000,
			shading: THREE.FlatShading,
			blending: THREE.NormalBlending,
			depthTest: true,
			transparent: false,
			opacity: 1.0,
		});

		trunkGeom = new THREE.CylinderGeometry(50, 50, 200, 8, 1, false);
		treeGeom = new THREE.CylinderGeometry(0, 250, 1200, 40, 1, false);

		var tree;
		for (i = 0; i < TREE_COUNT; i++) {

			var scl = ATUtil.randomRange(0.8, 1.3);
			var matID = i % TREE_COLS.length;
			tree = makeTree(scl, matID);
			moverGroup.add(tree);
			tree.posi = Math.random();
			tree.posj = Math.random();
			tree.position.x = tree.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH / 2;
			tree.position.z = -(tree.posi * WRConfig.FLOOR_DEPTH) + WRConfig.FLOOR_DEPTH / 2;
			tree.rotation.y = Math.random() * Math.PI * 2;
			trees.push(tree);
			tree.collided = false;
		}

		//add trees down the edges
		var EDGE_TREE_COUNT = 12;
		for (i = 0; i < EDGE_TREE_COUNT; i++) {
			tree = makeTree(1.3, 0);
			moverGroup.add(tree);
			tree.position.x = WRConfig.FLOOR_WIDTH / 2 + 300;
			tree.position.z = WRConfig.FLOOR_DEPTH * i / EDGE_TREE_COUNT - WRConfig.FLOOR_DEPTH / 2;

		}

		for (i = 0; i < EDGE_TREE_COUNT; i++) {
			tree = makeTree(1.3, 0);
			moverGroup.add(tree);
			tree.position.x = -(WRConfig.FLOOR_WIDTH / 2 + 300);
			tree.position.z = WRConfig.FLOOR_DEPTH * i / EDGE_TREE_COUNT - WRConfig.FLOOR_DEPTH / 2;
		}

		/*
		 * 陈龙江
		 * 2018/1/10
		 * 修改奖励模型形状、颜色、点光源
		 */
		//add floating present
		presentGroup = new THREE.Object3D();
		moverGroup.add(presentGroup);

		presentGroup.position.x = ATUtil.randomRange(-WRConfig.FLOOR_WIDTH / 2, WRConfig.FLOOR_WIDTH / 2);
		presentGroup.position.z = ATUtil.randomRange(-WRConfig.FLOOR_DEPTH / 2, WRConfig.FLOOR_DEPTH / 2);
		//presentGroup.position.y = 200;

		var presentMaterial = new THREE.MeshPhongMaterial({
			color: 0x1AE6E6,
			specular: 0x00FFFF,
			emissive: 0x0000FF,
			shininess: 60,
			shading: THREE.FlatShading,
			blending: THREE.NormalBlending,
			depthTest: true,
			transparent: false,
			opacity: 1.0
		});

		var presentGeom = new THREE.IcosahedronGeometry(100, 2);

		var present = new THREE.Mesh(presentGeom, presentMaterial);
		presentGroup.add(present);

		//PointLight(hex, intensity, distance)
		var presentLight = new THREE.PointLight(0x2248DD, 1.8, 1000);
		presentGroup.add(presentLight);
		presentGroup.collided = false;

		/*
		 * 李永盛
		 * 2018/1/10
		 * 加一只怪物
		 */
		monsterGroup = new THREE.Object3D();
		WRMain.getScene().add(monsterGroup);

		var loader = new THREE.JSONLoader();
		loader.load("res/model/monster/monster.js", function (geometry, materials) {
			geometry.computeVertexNormals();
			geometry.computeMorphNormals();

			// adjust color a bit
			var material = materials[0];
			material.morphTargets = true;
			material.morphNormals = true;
			//material.color.setHex(0xEE6363);
			material.color.setHex(0xff0000);

			monster = new THREE.Mesh(geometry, materials);
			monster.position.set(0, -150, WRConfig.FLOOR_DEPTH / 2 - 1200);
			monster.rotateY(Math.PI / 2);
			monster.scale.set(0.2, 0.2, 0.2);
			monsterGroup.add(monster);
			if (WRConfig.showDebug) {
				WRMain.getScene().add(new THREE.BoxHelper(monster));
			}
			var mixer = new THREE.AnimationMixer(monster);
			mixer.clipAction(geometry.animations[0], monster).setDuration(1).play();
			mixers.push(mixer);
		});

		/*胡俊钦
		 * 2018/1/9
		 * 实现改变灯光效果的功能*/

		// begin
		var controls = new function () {
			this.hemisphere = true;
			this.groundColor = 0x00ff00;
			this.skyColor = 0x0000ff;
			this.intensity = 0.6;

		};

		var gui = new dat.GUI();

		gui.add(controls, 'hemisphere').onChange(function (e) {

			if (!e) {
				hemisphereLight.intensity = 0;
			} else {
				hemisphereLight.intensity = controls.intensity;
			}
		});
		gui.addColor(controls, 'groundColor').onChange(function (e) {
			hemisphereLight.groundColor = new THREE.Color(e);
		});
		gui.addColor(controls, 'skyColor').onChange(function (e) {
			hemisphereLight.color = new THREE.Color(e);
		});
		gui.add(controls, 'intensity', 0, 5).onChange(function (e) {
			hemisphereLight.intensity = e;
		});
		//end

		WRSnow.init();

		setFloorHeight();

		resetField();

		clock.start();
		maxSpeed = START_MAX_SPEED;

	}

    /*
         * 刘晨瑶
         * 2018/1/10
         * 构建地图元素
         */

	function makeTree(scale, materialID) {

		var tree = new THREE.Object3D();
		var branches = new THREE.Mesh(treeGeom, treeMaterials[materialID]);
		var trunk = new THREE.Mesh(trunkGeom, trunkMaterial);
		tree.add(branches);
		tree.add(trunk);
		trunk.position.y = -700;
		tree.scale.x = tree.scale.z = tree.scale.y = scale;
		tree.myheight = 1400 * tree.scale.y;
		//put tree on floor
		tree.position.y = tree.myheight / 2 - 300;
		return tree;
	}

	function setFloorHeight() {

		//apply noise to floor

		//move mover back by WRConfig.MOVE_STEP
		stepCount++;
		moverGroup.position.z = -WRConfig.MOVE_STEP;

		//calculate vert psons base on noise
		var i;
		var ipos;
		var offset = stepCount * WRConfig.MOVE_STEP / WRConfig.FLOOR_DEPTH * FLOOR_RES;

		for (i = 0; i < FLOOR_RES + 1; i++) {
			for (var j = 0; j < FLOOR_RES + 1; j++) {
				ipos = i + offset;
				floorGeometry.vertices[i * (FLOOR_RES + 1) + j].z = snoise.noise(ipos / FLOOR_RES * noiseScale, j / FLOOR_RES * noiseScale, noiseSeed) * FLOOR_THICKNESS;
			}
		}
		floorGeometry.verticesNeedUpdate = true;

		for (i = 0; i < TREE_COUNT; i++) {

			var tree = trees[i];
			tree.position.z += WRConfig.MOVE_STEP;

			if (tree.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH / 2) {

				tree.collided = false;
				tree.position.z -= WRConfig.FLOOR_DEPTH;
				ipos = tree.posi + offset / FLOOR_RES * WRConfig.FLOOR_DEPTH;
				//re-randomize x pos
				tree.posj = Math.random();
				tree.position.x = tree.posj * WRConfig.FLOOR_WIDTH - WRConfig.FLOOR_WIDTH / 2;
				tree.visible = true;
			}

		}

		WRSnow.shift();

		//shift present
		presentGroup.position.z += WRConfig.MOVE_STEP;
		if (presentGroup.position.z + moverGroup.position.z > WRConfig.FLOOR_DEPTH / 2) {
			presentGroup.collided = false;
			presentGroup.position.z -= WRConfig.FLOOR_DEPTH;
			//re-randomize x pos
			presentGroup.posj = Math.random();
			var xRange = WRConfig.FLOOR_WIDTH / 2 * 0.7;
			presentGroup.position.x = ATUtil.randomRange(-xRange, xRange);

		}

	}


    /*
     * 刘晨瑶
     * 2018/1/10
     * 游戏效果
     */
	function animate() {


		var i;

		var delta = clock.getDelta();

		//游戏视觉的移动
		if (playing) {

			//速度渐增
			maxSpeed += delta * MAX_SPEED_ACCEL;
			maxSpeed = Math.min(maxSpeed, FINAL_MAX_SPEED);

			//碰撞后小幅加速
			moveSpeed += delta * ACCEL;
			moveSpeed = Math.min(moveSpeed, maxSpeed);

			//控制按键
			if (rightDown) {

				slideSpeed += SIDE_ACCEL;
				slideSpeed = Math.min(slideSpeed, MAX_SIDE_SPEED);

			} else if (leftDown) {

				slideSpeed -= SIDE_ACCEL;
				slideSpeed = Math.max(slideSpeed, -MAX_SIDE_SPEED);

			} else {
				slideSpeed *= 0.8;
			}

			//bounce off edges of rails
			var nextx = WRMain.getCamera().position.x + delta * slideSpeed;

			if (nextx > WRConfig.FLOOR_WIDTH / 2 || nextx < -WRConfig.FLOOR_WIDTH / 2) {
				slideSpeed = -slideSpeed;
				WRMain.playCollide();
			}

			// 移动怪物和相机位置
			monsterGroup.position.x += delta * slideSpeed;
			WRMain.getCamera().position.x += delta * slideSpeed;

			//略微倾斜
			moverGroup.rotation.z = slideSpeed * 0.000000001;

		} else {
			//死亡后减速
			moveSpeed *= 0.95;

		}

		// 更新怪物动作
		for (var i = 0; i < mixers.length; i++) {
			mixers[i].update(delta);
		}

		presentGroup.rotation.x += 0.01;
		presentGroup.rotation.y += 0.02;

		moverGroup.position.z += delta * moveSpeed;

		if (moverGroup.position.z > 0) {
			//刷新赛道
			setFloorHeight();
		}

		WRSnow.animate();

		//碰撞检测
		if (WRConfig.hitDetect) {

			var p;
			var dist;

			var camPos = WRMain.getCamera().position.clone();
			camPos.z -= 1200;

			p = presentGroup.position.clone();
			p.add(moverGroup.position);
			dist = p.distanceTo(camPos);
			if (dist < 200 && !presentGroup.collided) {
				//GOT POINT

				// 把水晶移到视野后
				presentGroup.position.z = 3700;

				presentGroup.collided = true;
				WRMain.onScorePoint();
			}


			for (i = 0; i < TREE_COUNT; i++) {

				p = trees[i].position.clone();
				p.y = 0; //ignore tree height
				p.add(moverGroup.position);

				//当树在正前方时发生碰撞
				if (p.z < camPos.z && p.z > camPos.z - 200) {

					dist = p.distanceTo(camPos);
					if (dist < 200 && !trees[i].collided) {

						//GAME OVER
						trees[i].collided = true;
						onGameEnd();
					}
				}
			}
		}

	}


	function startGame(isFirstGame) {

		acceptInput = false;
		//第一次进入游戏
		if (isFirstGame) {
			startRun();
			return;
		}

		//淡出
		TweenMax.fromTo(WRMain.fxParams, 0.3, {
			brightness: 0
		}, {
			brightness: -1
		});
		TweenMax.delayedCall(0.3, resetField);
		TweenMax.fromTo(WRMain.fxParams, 0.3, {
			brightness: -1
		}, {
			brightness: 0,
			delay: 0.3
		});
		TweenMax.delayedCall(0.6, startRun);

	}

	function resetField() {

		var camPos = WRMain.getCamera().position;
		//摄像机重置为中央
		camPos.x = 0;
		//分数归零
		slideSpeed = 0;
		//物体位置归零
		moverGroup.rotation.z = 0;
		monsterGroup.position.x = 0;
		//开始时树设置较远
		for (i = 0; i < TREE_COUNT; i++) {
			p = trees[i].position.clone();
			p.add(moverGroup.position);

			if (p.z < camPos.z && p.z > camPos.z - WRConfig.FLOOR_DEPTH / 2) {
				trees[i].collided = true;
				trees[i].visible = false;
			}
		}

	}

	function startRun() {
		playing = true;
		acceptInput = true;
	}

	function onAcceptInput() {
		acceptInput = true;
	}

	function onGameEnd() {
		moveSpeed = -1200;
		maxSpeed = START_MAX_SPEED;
		playing = false;
		acceptInput = false;
		//wait before re-enabling start game
		TweenMax.delayedCall(1, onAcceptInput);
		WRMain.onGameOver();

	}

	return {
		init: init,
		startGame: startGame,
		animate: animate,
		setRightDown: function (b) {
			rightDown = b;
		},
		setLeftDown: function (b) {
			leftDown = b;
		},
		getPlaying: function () {
			return playing;
		},
		getMoverGroup: function () {
			return moverGroup;
		},
		getSpeed: function () {
			return moveSpeed / FINAL_MAX_SPEED;
		},
		resetField: resetField,
		getAcceptInput: function () {
			return acceptInput;
		},
	};


}();