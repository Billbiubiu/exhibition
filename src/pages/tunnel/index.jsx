import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";

// const variables
const { PI } = Math;
const HALF_PI = PI / 2;
const TUNNEL_LENGTH = 200;
const TUNNEL_RADIUS = 20;

// common functions
const isObject = (obj) => {
  return Object.prototype.toString.call(obj) === "[object Object]";
};
const useMerge = (setState) => {
  return useCallback(
    (merge) => {
      setState((oldState) => ({ ...oldState, ...merge }));
    },
    [setState]
  );
};
const mergeTransfrom = (target, merge) => {
  const _target = target;
  if (!isObject(_target) || !isObject(merge)) return;
  Object.keys(merge).forEach((key) => {
    const value = merge[key];
    const targetIsObject = isObject(_target[key]);
    const valueIsObject = isObject(value);
    if (targetIsObject && valueIsObject) {
      mergeTransfrom(_target[key], value);
    } else if (!targetIsObject && !valueIsObject) {
      _target[key] = value;
    }
  });
};
const generateGroup = (...geometries) => {
  const group = new THREE.Group();
  [...geometries].forEach((geometry) => {
    group.add(geometry);
  });
  return group;
};
// arc: 隧道口, tunnel: 隧道
const renderArc = (
  outerRadius = TUNNEL_RADIUS - 0.01,
  innerRadius = TUNNEL_RADIUS - 1
) => {
  const outerPoints = [];
  const innerPoints = [];
  for (let i = 0; i < 19; i++) {
    const rad = ((i * 10) / 180) * PI;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    outerPoints.push(new THREE.Vector2(outerRadius * cos, outerRadius * sin));
    innerPoints.push(new THREE.Vector2(innerRadius * cos, innerRadius * sin));
  }
  const points = [...outerPoints, ...innerPoints.reverse()];
  // const extrude = { depth: 0.2, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 1, bevelThickness: 1 };
  const extrude = {
    depth: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 2,
    bevelSize: 0,
    bevelThickness: 0,
  };
  const shape = new THREE.Shape(points);
  const geometry = new THREE.ExtrudeGeometry(shape, extrude);
  const material = new THREE.MeshBasicMaterial({
    color: 0xdcdcda,
    side: THREE.DoubleSide,
  });
  const arc = new THREE.Mesh(geometry, material);
  mergeTransfrom(arc, { rotation: { x: HALF_PI } });
  return generateGroup(arc);
};
const renderTunnel = (
  length = TUNNEL_LENGTH,
  radius = TUNNEL_RADIUS,
  segments = 18
) => {
  const halfLength = length / 2;
  const points = [
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius, length),
  ];
  const geometry = new THREE.LatheGeometry(points, segments, 0, PI);
  const material = new THREE.MeshBasicMaterial({
    color: 0x4599c6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.2,
  });
  const tunnel = new THREE.Mesh(geometry, material);
  mergeTransfrom(tunnel, {
    rotation: { y: -HALF_PI },
    position: { y: -halfLength },
  });
  const arc_1 = renderArc();
  const arc_2 = arc_1.clone();
  mergeTransfrom(arc_1, { position: { y: halfLength } });
  mergeTransfrom(arc_2, { position: { y: -halfLength } });
  return generateGroup(tunnel, arc_1, arc_2);
};
// floor: 路基
const renderFloor = (
  length = TUNNEL_LENGTH + 100,
  width = TUNNEL_RADIUS * 2,
  depth = 1
) => {
  const geometry = new THREE.BoxGeometry(width, length, depth);
  const texture = new THREE.TextureLoader().load("./images/路面.png");
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.rotation = PI;
  const material = new THREE.MeshFaceMaterial([
    new THREE.MeshLambertMaterial({ color: 0x59c4fe }),
    new THREE.MeshLambertMaterial({ color: 0x59c4fe }),
    new THREE.MeshLambertMaterial({ color: 0x59c4fe }),
    new THREE.MeshLambertMaterial({ color: 0x59c4fe }),
    new THREE.MeshLambertMaterial({ map: texture }),
    new THREE.MeshLambertMaterial({ color: 0x59c4fe }),
  ]);
  const floor = new THREE.Mesh(geometry, material);
  floor.position.z = -depth / 2;
  return generateGroup(floor);
};
// passage: 通道
const renderPassage = (length = 46, width = 4.25, height = 8.5) => {
  const geometry = new THREE.BoxGeometry(length, width, height);
  const material = new THREE.MeshFaceMaterial([
    new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0,
    }),
    new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0,
    }),
    new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    }),
  ]);
  const passage = new THREE.Mesh(geometry, material);
  passage.position.z = height / 2;
  return generateGroup(passage);
};
// 加载模型
const loadModel = (name) => {
  return new Promise((resolve) => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();
    mtlLoader.load(`./models/${name}.mtl`, (mtl) => {
      mtl.preload();
      objLoader.setMaterials(mtl);
      objLoader.load(`./models/${name}.obj`, (obj) => {
        resolve(obj);
      });
    });
  });
};

const ThreeJs = () => {
  const containerRef = useRef();
  // geometries
  const [geometries, setGeometries] = useState({});
  const mergeGeometries = useMerge(setGeometries);
  // animations
  const [animations, setAnimations] = useState({});
  const mergeAnimations = useMerge(setAnimations);
  useEffect(() => {
    const tunnelOffsetX = 40;
    // 隧道
    const tunnel_1 = renderTunnel();
    const tunnel_2 = tunnel_1.clone();
    mergeTransfrom(tunnel_1, { position: { x: -tunnelOffsetX } });
    mergeTransfrom(tunnel_2, { position: { x: tunnelOffsetX } });
    // 路面
    const floor_1 = renderFloor();
    const floor_2 = floor_1.clone();
    mergeTransfrom(floor_1, { position: { x: -tunnelOffsetX } });
    mergeTransfrom(floor_2, { position: { x: tunnelOffsetX } });
    mergeGeometries({
      tunnel_1,
      tunnel_2,
      floor_1,
      floor_2,
    });
    // 模型
    loadModel("喇叭").then((model) => {
      mergeTransfrom(model, { scale: { x: 0.05, y: 0.05, z: 0.05 } });
      const 喇叭_1 = model.clone();
      mergeTransfrom(喇叭_1, {
        rotation: { x: -HALF_PI, z: Math.PI },
        position: {
          x: -(tunnelOffsetX + 5),
          y: TUNNEL_LENGTH / 2,
          z: TUNNEL_RADIUS - 5,
        },
      });
      const 喇叭_2 = model.clone();
      mergeTransfrom(喇叭_2, {
        rotation: { x: HALF_PI },
        position: {
          x: tunnelOffsetX + 5,
          y: -TUNNEL_LENGTH / 2,
          z: TUNNEL_RADIUS - 5,
        },
      });
      mergeGeometries({ 喇叭_1, 喇叭_2 });
    });
    loadModel("变压器").then((model) => {
      // 解决材质暗淡问题
      model.traverse((child) => {
        if (child.isMesh) {
          child.material.emissive = child.material.color;
          child.material.emissiveMap = child.material.map;
        }
      });
      mergeTransfrom(model, {
        position: { x: -1091142, y: -45.2296, z: 48027.5938 },
      });
      const 变压器 = generateGroup(model);
      mergeTransfrom(变压器, {
        rotation: { x: HALF_PI },
        scale: { x: 0.02, y: 0.02, z: 0.02 },
      });
      const 变压器_1 = generateGroup(变压器.clone());
      mergeTransfrom(变压器_1, {
        position: {
          x: -(tunnelOffsetX + TUNNEL_RADIUS * 2),
          y: TUNNEL_LENGTH / 2,
        },
      });
      const 变压器_2 = generateGroup(变压器.clone());
      mergeTransfrom(变压器_2, {
        rotation: { z: PI },
        position: {
          x: tunnelOffsetX + TUNNEL_RADIUS * 2,
          y: -TUNNEL_LENGTH / 2,
        },
      });
      mergeGeometries({ 变压器_1, 变压器_2 });
    });
    loadModel("横洞").then((model) => {
      mergeTransfrom(model, { position: { x: -2192625, y: -2342, z: 164249 } });
      const 横洞 = generateGroup(model);
      mergeTransfrom(横洞, {
        rotation: { x: HALF_PI },
        scale: { x: 0.01, y: 0.01, z: 0.01 },
        position: { x: -0.2, y: 3.2 },
      });
      const transforms = [
        { position: { y: (TUNNEL_LENGTH / 8) * 3 } },
        { scale: { y: 2 }, position: { y: TUNNEL_LENGTH / 4 + 2 } },
        { position: { y: TUNNEL_LENGTH / 8 } },
        { scale: { y: 2 } },
        { position: { y: -TUNNEL_LENGTH / 8 } },
        { scale: { y: 2 }, position: { y: -TUNNEL_LENGTH / 4 - 2 } },
        { position: { y: (-TUNNEL_LENGTH / 8) * 3 } },
      ];
      const 横洞_left = generateGroup(横洞.clone());
      mergeTransfrom(横洞_left, {
        position: { x: -(tunnelOffsetX - TUNNEL_RADIUS + 3) },
      });
      const passage = renderPassage();
      const 横洞_right = generateGroup(横洞.clone());
      mergeTransfrom(横洞_right, {
        position: { x: tunnelOffsetX - TUNNEL_RADIUS + 3 },
      });
      const 横洞_list = generateGroup(
        ...transforms.map((transform) => {
          const item = generateGroup(横洞_left, passage, 横洞_right).clone();
          mergeTransfrom(item, transform);
          return item;
        })
      );
      mergeGeometries({ 横洞_list });
    });
    loadModel("排风").then((model) => {
      mergeTransfrom(model, {
        position: { x: -1091085.75, y: -3890.9917, z: 81965.5313 },
      });
      const 排风 = generateGroup(model);
      mergeTransfrom(排风, {
        rotation: { x: HALF_PI },
        scale: { x: 0.01, y: 0.01, z: 0.01 },
        position: { x: 1.3, y: 2.5 },
      });
      const _排风 = generateGroup(排风);
      const quarterRadius = TUNNEL_RADIUS / 4;
      const transforms = [
        { position: { x: -quarterRadius, y: 10 } },
        { position: { x: quarterRadius, y: 10 } },
        { position: { x: -quarterRadius } },
        { position: { x: quarterRadius } },
        { position: { x: -quarterRadius, y: -10 } },
        { position: { x: quarterRadius, y: -10 } },
      ];
      const 排风_cluster = generateGroup(
        ...transforms.map((transform) => {
          const item = generateGroup(_排风.clone());
          mergeTransfrom(item, transform);
          return item;
        })
      );
      mergeTransfrom(排风_cluster, { position: { z: TUNNEL_RADIUS - 5 } });
      const 排风_cluster_1 = 排风_cluster.clone();
      mergeTransfrom(排风_cluster_1, {
        position: { x: -tunnelOffsetX, y: TUNNEL_LENGTH / 2 - 20 },
      });
      const 排风_cluster_2 = 排风_cluster.clone();
      mergeTransfrom(排风_cluster_2, {
        position: { x: -tunnelOffsetX, y: -(TUNNEL_LENGTH / 2 - 20) },
      });
      const 排风_cluster_3 = 排风_cluster.clone();
      mergeTransfrom(排风_cluster_3, {
        position: { x: tunnelOffsetX, y: TUNNEL_LENGTH / 2 - 20 },
      });
      const 排风_cluster_4 = 排风_cluster.clone();
      mergeTransfrom(排风_cluster_4, {
        position: { x: tunnelOffsetX, y: -(TUNNEL_LENGTH / 2 - 20) },
      });
      mergeGeometries({
        排风_cluster_1,
        排风_cluster_2,
        排风_cluster_3,
        排风_cluster_4,
      });
      const 排风_list = [
        排风_cluster_1,
        排风_cluster_2,
        排风_cluster_3,
        排风_cluster_4,
      ].reduce((result, item) => {
        return [...result, ...item.children];
      }, []);
      const animation = () => {
        排风_list.forEach((item) => {
          item.rotation.y += 0.1;
        });
      };
      mergeAnimations({ 排风: animation });
    });
  }, [mergeGeometries, mergeAnimations]);

  // three.js instance
  const [instance, setInstance] = useState({});
  // init three.js instance
  useEffect(() => {
    const container = containerRef.current;
    const { offsetWidth = 100, offsetHeight = 100 } = container || {};
    // scene
    const scene = new THREE.Scene();
    scene.rotation.x = -HALF_PI;
    // camera
    const camera = new THREE.PerspectiveCamera(
      75,
      offsetWidth / offsetHeight,
      0.1,
      1000
    );
    // const camera = new THREE.OrthographicCamera(-offsetWidth / 2, offsetWidth / 2, offsetHeight / 2, -offsetHeight / 2, 1, 1000);
    camera.position.y = 50;
    camera.position.z = 250;
    camera.lookAt({ x: 0, y: 0, z: 0 });
    // renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(offsetWidth, offsetHeight);
    renderer.setClearColor(0x222842, 1);
    // light
    const light = new THREE.AmbientLight(0xffffff);
    light.position.set(0, 0, 20);
    scene.add(light);
    // orbit control
    const controls = new OrbitControls(camera, renderer.domElement);
    // controls.autoRotate = true; // 自动旋转
    controls.enableDamping = true; // 启用阻尼
    // grid
    const grid = new THREE.GridHelper(500, 50);
    grid.rotation.x = PI / 2;
    grid.position.z = 0;
    scene.add(grid);
    container?.appendChild(renderer.domElement);
    setInstance({ scene, camera, renderer, controls, grid });
  }, []);
  useEffect(() => {
    const { scene, camera, renderer } = instance;
    if (!scene) return;
    // resize
    const resize = () => {
      const container = containerRef.current;
      const { offsetWidth = 100, offsetHeight = 100 } = container || {};
      camera.aspect = offsetWidth / offsetHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(offsetWidth, offsetHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, [instance]);

  // add objects
  useEffect(() => {
    const { scene } = instance;
    if (!scene) return;
    Object.values(geometries).forEach((geometry) => {
      scene.add(geometry);
    });
  }, [instance, geometries]);
  // play animations
  useEffect(() => {
    const { scene, camera, renderer, controls } = instance;
    if (!scene) return;
    let interrupt = false;
    const animate = () => {
      if (interrupt) return;
      requestAnimationFrame(animate);
      Object.values(animations).forEach((animation) => animation());
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      interrupt = true;
    };
  }, [instance, animations]);
  // 暴露全局变量，方便通过控制台调整
  window.instance = instance;
  window.geometries = geometries;
  window.animations = animations;
  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", touchAction: "none" }}
    />
  );
};

export default ThreeJs;
