import React, { useEffect, useReducer, useRef, useState } from 'react';
import * as three from 'three';
import * as turf from '@turf/turf';
import TWEEN from '@tweenjs/tween.js';
import { makeRadian, getRotation } from '../../utils';
import { Spin, Button } from 'antd';

const { PI } = Math;
const HALF_PI = PI / 2;
const DOUBLE_PI = PI * 2;
// 是否为移动端
const IS_MOBILE = window.navigator.userAgent.toLowerCase().indexOf('mobile') > -1;

// 已按下的键
const keySet = new Set();
const init = container => {
  const { offsetWidth, offsetHeight } = container;
  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(75, offsetWidth / offsetHeight, 0.1, 1000);
  camera.position.set(0, 0, 12);
  camera.rotation.set(HALF_PI, 0, 0);
  const renderer = new three.WebGLRenderer({ antialias: true });
  renderer.setSize(offsetWidth, offsetHeight);
  renderer.setClearColor(0x222842, 1);
  container.appendChild(renderer.domElement);
  // 添加实例到window对象，方便调试
  window.scene = scene;
  window.camera = camera;
  window.renderer = renderer;
  return { scene, camera, renderer };
};
// 添加环境光
const addLights = ({ scene }) => {
  const ambientLight = new three.AmbientLight(0xFFFFFF, 0.5);
  scene.add(ambientLight);
};
// 添加鼠标控制、手势控制、键盘控制
const addControls = ({ camera, renderer }, boundariesRef) => {
  const { domElement } = renderer;
  // 判断移动后是否在范围内
  const isPointInBoundaries = point => {
    const boundaries = boundariesRef.current;
    if (!boundaries.length) return false;
    return !!boundaries.find(boundary => {
      return turf.booleanPointInPolygon(turf.point(point), boundary);
    });
  };
  // 移动相机
  const moveCamera = (dx, dy, callback) => {
    const x = camera.position.x + dx;
    const y = camera.position.y + dy;
    if (!isPointInBoundaries([x, y])) return;
    camera.position.x = x;
    camera.position.y = y;
    callback && requestAnimationFrame(callback);
  };
  // 监听触摸
  const addTouchControls = () => {
    const onTouchStart = startEvent => {
      const { touches: startTouches } = startEvent;
      if (startTouches.length === 1) {
        const { offsetWidth, offsetHeight } = domElement;
        const { x, y } = camera.rotation;
        const { clientX: startX, clientY: startY } = startTouches[0];
        const onTouchMove = moveEvent => {
          const { touches: moveTouches } = moveEvent;
          if (moveTouches.length !== 1) return;
          const { clientX: moveX, clientY: moveY } = moveTouches[0];
          const dy = moveY - startY;
          const rotationX = x + (dy / (offsetHeight / 2) * PI);
          camera.rotation.x = rotationX;
          camera.rotation.x = x; // 不允许沿x轴转动
          const dx = moveX - startX;
          const rotationY = y + (dx / (offsetWidth / 2) * (2 * PI))
          camera.rotation.y = rotationY;
        }
        const onTouchEnd = () => {
          domElement.removeEventListener('touchmove', onTouchMove);
          domElement.removeEventListener('touchend', onTouchEnd);
        }
        domElement.addEventListener('touchmove', onTouchMove);
        domElement.addEventListener('touchend', onTouchEnd);
      } else if (startTouches.length === 2) {
        const { x, y } = camera.position;
        const startDistance = Math.sqrt(Math.pow((startTouches[0].clientX - startTouches[1].clientX), 2) + Math.pow((startTouches[0].clientY - startTouches[1].clientY), 2));
        const onTouchMove = moveEvent => {
          const { touches: moveTouches } = moveEvent;
          if (moveTouches.length !== 2) return;
          const moveDistance = Math.sqrt(Math.pow((moveTouches[0].clientX - moveTouches[1].clientX), 2) + Math.pow((moveTouches[0].clientY - moveTouches[1].clientY), 2));
          const ratio = moveDistance / startDistance;
          const { y: rotationY } = camera.rotation;
          if (ratio < 1) {
            const dx = Math.sin(rotationY) * 10;
            const dy = -Math.cos(rotationY) * 10;
            camera.position.x = x + (dx * (1 / ratio));
            camera.position.y = y + (dy * (1 / ratio));
          } else {
            const dx = -Math.sin(rotationY) * 10;
            const dy = Math.cos(rotationY) * 10;
            camera.position.x = x + (dx * ratio);
            camera.position.y = y + (dy * ratio);
          }
        };
        const onTouchEnd = () => {
          domElement.removeEventListener('touchmove', onTouchMove);
          domElement.removeEventListener('touchend', onTouchEnd);
        }
        domElement.addEventListener('touchmove', onTouchMove);
        domElement.addEventListener('touchend', onTouchEnd);
      }
    };
    domElement.addEventListener('touchstart', onTouchStart);
  };
  // 监听鼠标
  const addMouseControls = () => {

    const onPointerDown = downEvent => {
      const { offsetWidth, offsetHeight } = domElement;
      const { x, y } = camera.rotation;
      const { offsetX: downX, offsetY: downY } = downEvent;
      const onPointerMove = moveEvent => {
        const { offsetX: moveX, offsetY: moveY } = moveEvent;
        const dy = moveY - downY;
        const rotationX = x + (dy / (offsetHeight / 2) * PI);
        camera.rotation.x = rotationX;
        camera.rotation.x = x; // 不允许沿x轴转动
        const dx = moveX - downX;
        const rotationY = y + (dx / (offsetWidth / 2) * (2 * PI))
        camera.rotation.y = rotationY;
      }
      const onPointerUp = () => {
        domElement.removeEventListener('pointermove', onPointerMove);
        domElement.removeEventListener('pointerup', onPointerUp);
      }
      domElement.addEventListener('pointermove', onPointerMove);
      domElement.addEventListener('pointerup', onPointerUp);
    };
    const onWheel = e => {
      const { deltaY } = e;
      const { y: rotationY } = camera.rotation;
      // deltaY > 0 缩小
      if (deltaY > 0) {
        const dx = Math.sin(rotationY);
        const dy = -Math.cos(rotationY);
        moveCamera(dx, dy);
      } else {
        const dx = -Math.sin(rotationY);
        const dy = Math.cos(rotationY);
        moveCamera(dx, dy);
      }
    };
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('wheel', onWheel);
  };
  // 监听键盘
  const addKeyboardControls = () => {
    // 字母键对应的方向
    const keyMap = {
      'w': 'ArrowUp',
      'a': 'ArrowLeft',
      's': 'ArrowDown',
      'd': 'ArrowRight',
    };
    const onArrowUp = () => {
      if (keySet.has('ArrowUp')) {
        const { y: rotationY } = camera.rotation;
        const dx = -Math.sin(rotationY);
        const dy = Math.cos(rotationY);
        moveCamera(dx, dy, onArrowUp);
      }
    };
    const onArrowRight = () => {
      if (keySet.has('ArrowRight')) {
        if (keySet.has('Control')) {
          camera.rotation.y -= (PI / 180);
          requestAnimationFrame(onArrowRight);
        } else {
          const { y: rotationY } = camera.rotation;
          const dx = Math.cos(rotationY);
          const dy = Math.sin(rotationY);
          moveCamera(dx, dy, onArrowRight);
        }
      }
    };
    const onArrowDown = () => {
      if (keySet.has('ArrowDown')) {
        const { y: rotationY } = camera.rotation;
        const dx = Math.sin(rotationY);
        const dy = -Math.cos(rotationY);
        moveCamera(dx, dy, onArrowDown);
      }
    };
    const onArrowLeft = () => {
      if (keySet.has('ArrowLeft')) {
        if (keySet.has('Control')) {
          camera.rotation.y += (PI / 180);
          requestAnimationFrame(onArrowLeft);
        } else {
          const { y: rotationY } = camera.rotation;
          const dx = -Math.cos(rotationY);
          const dy = -Math.sin(rotationY);
          moveCamera(dx, dy, onArrowLeft);
        }
      }
    };
    const onKeyDown = e => {
      let { key } = e;
      key = keyMap[key] || key;
      if (keySet.has(key)) return;
      keySet.add(key);
      switch (key) {
        case 'Control':
          keySet.add('Control');
          break;
        case 'ArrowUp':
          keySet.delete('ArrowDown');
          onArrowUp();
          break;
        case 'ArrowRight':
          keySet.delete('ArrowLeft');
          onArrowRight();
          break;
        case 'ArrowDown':
          keySet.delete('ArrowUp');
          onArrowDown();
          break;
        case 'ArrowLeft':
          keySet.delete('ArrowRight');
          onArrowLeft();
          break;
        default:
          break;
      }
    };
    const onKeyUp = e => {
      let { key } = e;
      key = keyMap[key] || key;
      keySet.delete(key);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  };
  if (IS_MOBILE) {
    addTouchControls();
  } else {
    addMouseControls();
    addKeyboardControls();
  }
};
// 添加光线追踪，处理点击事件
const addRaycaster = ({ scene, camera, renderer }) => {
  const { domElement } = renderer;
  const onPointerDown = downEvent => {
    const { offsetX: downX, offsetY: downY } = downEvent;
    const startTime = Date.now();
    const onPointerUp = upEvent => {
      domElement.removeEventListener('pointerup', onPointerUp);
      const { offsetX: upX, offsetY: upY } = upEvent;
      const endTime = Date.now();
      // 判断是否为拖拽
      if (
        Math.abs(downX - upX) > 5 ||
        Math.abs(downY - upY) > 5 ||
        endTime - startTime > 1000
      ) return;
      const { offsetWidth, offsetHeight } = domElement;
      const raycaster = new three.Raycaster();
      const x = (upX / offsetWidth) * 2 - 1;
      const y = -(upY / offsetHeight) * 2 + 1;
      const mouse = new three.Vector2(x, y);
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const [intersect] = intersects;
      if (
        intersect &&
        intersect.object &&
        intersect.object.onClick
      ) {
        intersect.object.onClick(intersect);
      }
    }
    domElement.addEventListener('pointerup', onPointerUp);
  }
  domElement.addEventListener('pointerdown', onPointerDown);
};
// 添加 grid 参考和 axis 参考
// eslint-disable-next-line
const drawReferences = ({ scene }) => {
  const gridWidth = 100;
  const grid = new three.GridHelper(gridWidth, 10);
  grid.rotation.x = HALF_PI;
  scene.add(grid);
  const axes = new three.AxesHelper(gridWidth / 2);
  scene.add(axes);
};
// 绘制一楼
const drawFirstFloor = ({ scene, camera, setLoading, setCurrentExhibit }) => {
  const drawLights = () => {
    const lights = [
      new three.PointLight(0xFFFFFF, 1, 80),
      new three.PointLight(0xFFFFFF, 1, 80),
    ];
    lights[0].position.set(0, 25, 19);
    lights[1].position.set(0, -25, 19);
    return lights;
  };
  const drawFloor = () => {
    const geometry = new three.BoxGeometry(100, 100, 1);
    const material = new three.MeshPhysicalMaterial({ color: 0x333333 });
    const floor = new three.Mesh(geometry, material);
    floor.position.z = -0.5;
    const boundary = turf.polygon([[
      [-49, -49],
      [49, -49],
      [49, 49],
      [-49, 49],
      [-49, -49],
    ]]);
    floor.onClick = intersect => {
      // 控制范围，不能离墙过近
      let { x, y } = intersect.point;
      if (!turf.booleanPointInPolygon(turf.point([x, y]), boundary)) return;
      const distance = Math.sqrt(Math.pow(camera.position.x - x, 2) + Math.pow(camera.position.y - y, 2));
      const duration = distance * 10;
      new TWEEN.Tween(camera.position)
        .to({ x, y }, duration)
        .interpolation(TWEEN.Interpolation.Bezier)
        .easing(TWEEN.Easing.Linear.None)
        .start();
    };
    return floor;
  };
  const drawCeiling = () => {
    const geometry = new three.BoxGeometry(100, 100, 1);
    const material = new three.MeshPhysicalMaterial({ color: 0xFFFFFF });
    const ceiling = new three.Mesh(geometry, material);
    ceiling.position.z = 20 + 0.5;
    return ceiling;
  };
  // 绘制画框
  const drawFrame = ({ size }) => {
    const { width, height } = size;
    const shape = new three.Shape();
    const border = 0.4;
    shape.moveTo(0 - border, 0 - border);
    shape.lineTo(0 - border, height + border);
    shape.lineTo(width + border, height + border);
    shape.lineTo(width + border, 0 - border);
    const path = new three.Path()
    path.moveTo(0, 0);
    path.lineTo(0, height);
    path.lineTo(width, height);
    path.lineTo(width, 0);
    shape.holes.push(path);
    const extrude = { depth: border, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0, bevelThickness: 0 };
    const geometry = new three.ExtrudeGeometry(shape, extrude);
    const material = new three.MeshPhysicalMaterial({ color: 0xEEEEEE });
    const frame = new three.Mesh(geometry, material);
    frame.position.x = -(width / 2);
    frame.position.z = -(height / 2);
    frame.rotation.x = HALF_PI;
    return frame;
  };
  const drawExhibit = ({ url, rotation }) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        const { width, height } = image;
        const ratioX = width / 16;
        const ratioY = height / 9;
        const ratio = Math.max(ratioX, ratioY);
        const w = width / ratio;
        const h = height / ratio;
        const texture = new three.TextureLoader().load(url);
        const geometry = new three.BoxGeometry(w, h, 0.2);
        const material = [
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ map: texture }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
        ];
        const exhibit = new three.Mesh(geometry, material);
        exhibit.position.y = -0.2;
        exhibit.rotation.x = HALF_PI;
        exhibit.onClick = intersect => {
          var box = new three.Box3();
          box.setFromObject(intersect.object);
          const { min, max } = box;
          const center = {
            x: min.x + ((max.x - min.x) / 2),
            y: min.y + ((max.y - min.y) / 2),
            z: min.z + ((max.z - min.z) / 2),
          };
          // 根据墙面朝向计算新的相机位置
          const rotationZ = makeRadian(rotation.z);
          const newRotation = { y: getRotation(camera.rotation.y, rotationZ) };
          // 距离小于25米且夹角小于30度，弹出大图
          if (
            Math.sqrt(Math.pow(camera.position.x - center.x, 2) + Math.pow(camera.position.y - center.y, 2)) <= 25 &&
            Math.abs(makeRadian(camera.rotation.y) - rotationZ) < (PI / 6)
          ) {
            setCurrentExhibit(url);
          } else {
            const newPosition = { x: center.x - (Math.sin(DOUBLE_PI - rotationZ) * 20), y: center.y - (Math.cos(DOUBLE_PI - rotationZ) * 20) };
            const duration = Math.sqrt(Math.pow(camera.position.x - newPosition.x, 2) + Math.pow(camera.position.y - newPosition.y, 2)) * 10;
            new TWEEN.Tween(camera)
              .to({ position: newPosition, rotation: newRotation }, duration)
              .interpolation(TWEEN.Interpolation.Bezier)
              .easing(TWEEN.Easing.Linear.None)
              .start();
          }
        }
        const frame = drawFrame({ size: { width: w, height: h } });
        const group = new three.Group();
        group.add(exhibit, frame);
        resolve(group);
      };
      image.onerror = () => reject();
    })
  };
  const drawWall = ({ size, position, rotation, exhibits }) => {
    const { width, height, depth } = size;
    const geometry = new three.BoxGeometry(width, height, depth);
    const material = new three.MeshPhysicalMaterial({ color: 0xDDDDDD });
    const wall = new three.Mesh(geometry, material);
    wall.position.y = depth / 2;
    wall.position.z = height / 2;
    wall.rotation.x = -HALF_PI;
    // 墙脚
    const footer = new three.Mesh(
      new three.BoxGeometry(width + 0.2, depth + 0.2, 1),
      new three.MeshPhysicalMaterial({ color: 0x666666 }),
    );
    footer.position.y = depth / 2;
    footer.position.z = 0.5;
    // create group
    const group = new three.Group();
    group.add(wall, footer);
    Object.assign(group.position, position);
    Object.assign(group.rotation, rotation);
    // add exhibits
    const spacing = width / exhibits.length;
    const startX = spacing / 2;
    Promise.all(exhibits.map((url, index) => {
      return drawExhibit({ url, rotation }).then(res => {
        res.position.set(-(width / 2) + startX + (spacing * index), 0, 12);
        group.add(res);
      });
    })).finally(() => {
      setLoading(false);
    });
    return group;
  };
  const drawWalls = () => {
    const walls = [
      // 前
      {
        size: { width: 100, height: 20, depth: 1 },
        position: { x: 0, y: 50, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        exhibits: [
          './exhibits/1-1.jpg',
          './exhibits/1-2.jpg',
          './exhibits/1-3.jpg',
          './exhibits/1-4.jpg',
          './exhibits/1-5.jpg',
        ],
      },
      // 后
      {
        size: { width: 100, height: 20, depth: 1 },
        position: { x: 0, y: -50, z: 0 },
        rotation: { x: 0, y: 0, z: PI },
        exhibits: [
          './exhibits/2-1.jpg',
          './exhibits/2-2.jpg',
          './exhibits/2-3.jpg',
          './exhibits/2-4.jpg',
          './exhibits/2-5.jpg',
        ],
      },
      // 左
      {
        size: { width: 100, height: 20, depth: 1 },
        position: { x: -50, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: HALF_PI },
        exhibits: [
          './exhibits/3-1.jpg',
          './exhibits/3-2.jpg',
          './exhibits/3-3.jpg',
          './exhibits/3-4.jpg',
          './exhibits/3-5.jpg',
        ],
      },
      // 右
      {
        size: { width: 100, height: 20, depth: 1 },
        position: { x: 50, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: -HALF_PI },
        exhibits: [
          './exhibits/4-1.jpg',
          './exhibits/4-2.jpg',
          './exhibits/4-3.jpg',
          './exhibits/4-4.jpg',
          './exhibits/4-5.jpg',
        ],
      }
    ].map(drawWall);
    return walls;
  };
  const lights = drawLights();
  const floor = drawFloor();
  const ceiling = drawCeiling();
  const walls = drawWalls();
  // 中
  const wall = (() => {
    const width = 40, height = 20, depth = 1;
    const geometry = new three.BoxGeometry(width, height, depth);
    const texture = new three.TextureLoader().load('./exhibits/1-1.jpg');
    texture.rotation = PI;
    texture.center = new three.Vector2(0.5, 0.5);
    // size: 1440 * 1280
    // 1440 / 40 = 36
    // 36 * 20 = 720
    // 720 / 1280 = 0.5625
    // (1 - 0.5625) / 2 = 0.21875
    texture.repeat.set(1, 0.5625);
    texture.offset.set(0, 0.21875);
    const material = [
      new three.MeshPhysicalMaterial({ color: 0xDDDDDD }),
      new three.MeshPhysicalMaterial({ color: 0xDDDDDD }),
      new three.MeshPhysicalMaterial({ color: 0xDDDDDD }),
      new three.MeshPhysicalMaterial({ color: 0xDDDDDD }),
      new three.MeshPhysicalMaterial({ color: 0xDDDDDD }),
      new three.MeshPhysicalMaterial({ map: texture }),
    ];
    const wall = new three.Mesh(geometry, material);
    wall.position.z = height / 2;
    wall.rotation.x = -HALF_PI;
    // 墙脚
    const footer = new three.Mesh(
      new three.BoxGeometry(width + 0.2, depth + 0.2, 1),
      new three.MeshPhysicalMaterial({ color: 0x666666 }),
    );
    footer.position.z = 0.5;
    const group = new three.Group();
    group.add(wall, footer);
    return group;
  })();
  // 设置相机位置
  camera.position.set(0, -30, 12);
  camera.rotation.set(HALF_PI, 0, 0)
  return {
    geometries: [
      ...lights,
      floor,
      ceiling,
      ...walls,
      wall,
    ],
    boundaries: [
      turf.polygon([[
        [-49, -49],
        [49, -49],
        [49, 49],
        [-49, 49],
        [-49, -49],
      ]]),
    ],
  };
};
// 绘制二楼
const drawSecondFloor = ({ scene, camera, setLoading, setCurrentExhibit }) => {
  const drawLights = () => {
    const lights = [
      new three.PointLight(0xFFFFFF, 1, 80),
      new three.PointLight(0xFFFFFF, 1, 80),
    ];
    lights[0].position.set(0, -25, 19);
    lights[1].position.set(0, 25, 19);
    return lights;
  };
  const drawFloor = () => {
    const geometry = new three.BoxGeometry(100, 100, 1);
    const material = new three.MeshPhysicalMaterial({ color: 0x333333 });
    const floor = new three.Mesh(geometry, material);
    floor.position.z = -0.5;
    const boundary = turf.polygon([[
      [-49, -49],
      [49, -49],
      [49, 49],
      [-49, 49],
      [-49, -49],
    ]]);
    floor.onClick = intersect => {
      // 控制范围，不能离墙过近
      let { x, y } = intersect.point;
      if (!turf.booleanPointInPolygon(turf.point([x, y]), boundary)) return;
      const distance = Math.sqrt(Math.pow(camera.position.x - x, 2) + Math.pow(camera.position.y - y, 2));
      const duration = distance * 10;
      new TWEEN.Tween(camera.position)
        .to({ x, y }, duration)
        .interpolation(TWEEN.Interpolation.Bezier)
        .easing(TWEEN.Easing.Linear.None)
        .start();
    };
    return floor;
  };
  const drawCeiling = () => {
    const geometry = new three.BoxGeometry(100, 100, 1);
    const material = new three.MeshPhysicalMaterial({ color: 0xFFFFFF });
    const ceiling = new three.Mesh(geometry, material);
    ceiling.position.z = 20 + 0.5;
    return ceiling;
  };
  // 绘制画框
  const drawFrame = ({ size }) => {
    const { width, height } = size;
    const shape = new three.Shape();
    const border = 0.4;
    shape.moveTo(0 - border, 0 - border);
    shape.lineTo(0 - border, height + border);
    shape.lineTo(width + border, height + border);
    shape.lineTo(width + border, 0 - border);
    const path = new three.Path()
    path.moveTo(0, 0);
    path.lineTo(0, height);
    path.lineTo(width, height);
    path.lineTo(width, 0);
    shape.holes.push(path);
    const extrude = { depth: border, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0, bevelThickness: 0 };
    const geometry = new three.ExtrudeGeometry(shape, extrude);
    const material = new three.MeshPhysicalMaterial({ color: 0xEEEEEE });
    const frame = new three.Mesh(geometry, material);
    frame.position.x = -(width / 2);
    frame.position.z = -(height / 2);
    frame.rotation.x = HALF_PI;
    return frame;
  };
  const drawExhibit = ({ url, rotation }) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = url;
      image.onload = () => {
        const { width, height } = image;
        const ratioX = width / 16;
        const ratioY = height / 9;
        const ratio = Math.max(ratioX, ratioY);
        const w = width / ratio;
        const h = height / ratio;
        const texture = new three.TextureLoader().load(url);
        const geometry = new three.BoxGeometry(w, h, 0.2);
        const material = [
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
          new three.MeshPhysicalMaterial({ map: texture }),
          new three.MeshPhysicalMaterial({ color: 0xFFFFFF }),
        ];
        const exhibit = new three.Mesh(geometry, material);
        exhibit.position.y = -0.2;
        exhibit.rotation.x = HALF_PI;
        exhibit.onClick = intersect => {
          var box = new three.Box3();
          box.setFromObject(intersect.object);
          const { min, max } = box;
          const center = {
            x: min.x + ((max.x - min.x) / 2),
            y: min.y + ((max.y - min.y) / 2),
            z: min.z + ((max.z - min.z) / 2),
          };
          // 根据墙面朝向计算新的相机位置
          const rotationZ = makeRadian(rotation.z);
          const newRotation = { y: getRotation(camera.rotation.y, rotationZ) };
          // 距离小于25米且夹角小于30度，弹出大图
          if (
            Math.sqrt(Math.pow(camera.position.x - center.x, 2) + Math.pow(camera.position.y - center.y, 2)) <= 25 &&
            Math.abs(makeRadian(camera.rotation.y) - rotationZ) < (PI / 6)
          ) {
            setCurrentExhibit(url);
          } else {
            const newPosition = { x: center.x - (Math.sin(DOUBLE_PI - rotationZ) * 20), y: center.y - (Math.cos(DOUBLE_PI - rotationZ) * 20) };
            const duration = Math.sqrt(Math.pow(camera.position.x - newPosition.x, 2) + Math.pow(camera.position.y - newPosition.y, 2)) * 10;
            new TWEEN.Tween(camera)
              .to({ position: newPosition, rotation: newRotation }, duration)
              .interpolation(TWEEN.Interpolation.Bezier)
              .easing(TWEEN.Easing.Linear.None)
              .start();
          }
        }
        const frame = drawFrame({ size: { width: w, height: h } });
        const group = new three.Group();
        group.add(exhibit, frame);
        resolve(group);
      };
      image.onerror = () => reject();
    })
  };
  const drawWall = ({ size, position, rotation, exhibits }) => {
    const { width, height, depth } = size;
    const geometry = new three.BoxGeometry(width, height, depth);
    const material = new three.MeshPhysicalMaterial({ color: 0xDDDDDD });
    const wall = new three.Mesh(geometry, material);
    wall.position.y = depth / 2;
    wall.position.z = height / 2;
    wall.rotation.x = -HALF_PI;
    // 墙脚
    const footer = new three.Mesh(
      new three.BoxGeometry(width + 0.2, depth + 0.2, 1),
      new three.MeshPhysicalMaterial({ color: 0x666666 }),
    );
    footer.position.y = depth / 2;
    footer.position.z = 0.5;
    // create group
    const group = new three.Group();
    group.add(wall, footer);
    Object.assign(group.position, position);
    Object.assign(group.rotation, rotation);
    // add exhibits
    const spacing = width / exhibits.length;
    const startX = spacing / 2;
    Promise.all(exhibits.map((url, index) => {
      return drawExhibit({ url, rotation }).then(res => {
        res.position.set(-(width / 2) + startX + (spacing * index), 0, 12);
        group.add(res);
      });
    })).finally(() => {
      setLoading(false);
    });
    return group;
  };
  const drawWalls = () => {
    const walls = [
      // 前
      {
        size: { width: 100, height: 20, depth: 1 },
        position: { x: 0, y: 50, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        exhibits: [
          './exhibits/1-1.jpg',
          './exhibits/1-2.jpg',
          // './exhibits/1-3.jpg',
          './exhibits/1-4.jpg',
          './exhibits/1-5.jpg',
        ],
      },
      // 后
      {
        size: { width: 100, height: 20, depth: 1 },
        position: { x: 0, y: -50, z: 0 },
        rotation: { x: 0, y: 0, z: PI },
        exhibits: [
          './exhibits/2-1.jpg',
          './exhibits/2-2.jpg',
          // './exhibits/2-3.jpg',
          './exhibits/2-4.jpg',
          './exhibits/2-5.jpg',
        ],
      },
      // 左-1
      {
        size: { width: 50, height: 20, depth: 1 },
        position: { x: -50, y: 25, z: 0 },
        rotation: { x: 0, y: 0, z: HALF_PI },
        exhibits: [
          './exhibits/3-1.jpg',
          // './exhibits/3-2.jpg',
          // './exhibits/3-3.jpg',
          // './exhibits/3-4.jpg',
          // './exhibits/3-5.jpg',
        ],
      },
      // 左-2
      {
        size: { width: 50, height: 20, depth: 1 },
        position: { x: -50, y: -25, z: 0 },
        rotation: { x: 0, y: 0, z: HALF_PI },
        exhibits: [
          // './exhibits/3-1.jpg',
          // './exhibits/3-2.jpg',
          // './exhibits/3-3.jpg',
          // './exhibits/3-4.jpg',
          './exhibits/3-5.jpg',
        ],
      },
      // 中-左
      {
        size: { width: 30, height: 20, depth: 1 },
        position: { x: -35, y: -0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        exhibits: [
          './exhibits/3-2.jpg',
        ],
      },
      // 中-左
      {
        size: { width: 30, height: 20, depth: 1 },
        position: { x: -35, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: PI },
        exhibits: [
          './exhibits/3-4.jpg',
        ],
      },
      // 右-1
      {
        size: { width: 50, height: 20, depth: 1 },
        position: { x: 50, y: 25, z: 0 },
        rotation: { x: 0, y: 0, z: -HALF_PI },
        exhibits: [
          './exhibits/4-1.jpg',
          // './exhibits/4-2.jpg',
          // './exhibits/4-3.jpg',
          // './exhibits/4-4.jpg',
          // './exhibits/4-5.jpg',
        ],
      },
      // 右-2
      {
        size: { width: 50, height: 20, depth: 1 },
        position: { x: 50, y: -25, z: 0 },
        rotation: { x: 0, y: 0, z: -HALF_PI },
        exhibits: [
          // './exhibits/4-1.jpg',
          // './exhibits/4-2.jpg',
          // './exhibits/4-3.jpg',
          // './exhibits/4-4.jpg',
          './exhibits/4-5.jpg',
        ],
      },
      // 中-右
      {
        size: { width: 30, height: 20, depth: 1 },
        position: { x: 35, y: -0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        exhibits: [
          './exhibits/4-2.jpg',
        ],
      },
      // 中-右
      {
        size: { width: 30, height: 20, depth: 1 },
        position: { x: 35, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: PI },
        exhibits: [
          './exhibits/4-4.jpg',
        ],
      },
    ].map(drawWall);
    return walls;
  };
  const lights = drawLights();
  const floor = drawFloor();
  const ceiling = drawCeiling();
  const walls = drawWalls();
  // 设置相机位置
  camera.position.set(0, -30, 12);
  camera.rotation.set(HALF_PI, 0, 0)
  return {
    geometries: [
      ...lights,
      floor,
      ceiling,
      ...walls,
    ],
    boundaries: [
      turf.polygon([[
        [-49, -49],
        [49, -49],
        [49, -2],
        [19, -2],
        [19, 2],
        [49, 2],
        [49, 49],
        [-49, 49],
        [-49, 2],
        [-19, 2],
        [-19, -2],
        [-49, -2],
        [-49, -49],
      ]]),
    ],
  };
};
const floorMap = {
  1: drawFirstFloor,
  2: drawSecondFloor,
};

const Exhibition = () => {
  const containerRef = useRef();
  const [inited, setInited] = useState(false);
  const [
    {
      scene,
      camera,
      renderer
    },
    setInstances
  ] = useReducer((state, newState) => ({
    ...state,
    ...newState
  }), {});
  const [loading, setLoading] = useState(true);
  const [currentFloor, setCurrentFloor] = useState(1);
  // 楼层边界
  const boundariesRef = useRef([]);
  // 查看大图
  const [currentExhibit, setCurrentExhibit] = useState('');
  /**
   * 初始化
   */
  useEffect(() => {
    if (inited) return;
    const container = containerRef.current;
    const instances = init(container);
    setInited(true);
    setInstances(instances);
    addLights(instances);
    addControls(instances, boundariesRef);
    addRaycaster(instances);
    // drawReferences(instances);
  }, [inited]);
  /**
   * 监听窗口缩放
   */
  useEffect(() => {
    if (!camera || !renderer) return;
    // resize
    const onResize = () => {
      const container = containerRef.current;
      const { offsetWidth, offsetHeight } = container;
      camera.aspect = offsetWidth / offsetHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(offsetWidth, offsetHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [camera, renderer]);
  /**
   * 绘制楼层
   */
  useEffect(() => {
    if (!scene || !camera || !renderer) return;
    const renderFloor = floorMap[currentFloor];
    if (!renderFloor) return;
    setLoading(true);
    const {
      geometries,
      boundaries,
    } = renderFloor({
      scene,
      camera,
      renderer,
      setLoading,
      setCurrentExhibit
    });
    scene.add(...geometries);
    boundariesRef.current = boundaries;
    return () => {
      scene.remove(...geometries);
      boundariesRef.current = [];
    };
  }, [scene, camera, renderer, currentFloor]);
  /**
   * 渲染场景
   */
  useEffect(() => {
    if (!scene || !camera || !renderer) return;
    let interrupt = false;
    const update = () => {
      if (interrupt) return;
      requestAnimationFrame(update);
      TWEEN.update();
      renderer.render(scene, camera);
    };
    update();
    return () => interrupt = true;
  }, [scene, camera, renderer]);
  useEffect(() => {
    const handleEscape = e => {
      const { key } = e;
      if (key === 'Escape') {
        setCurrentExhibit('');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
  return (
    <Spin spinning={loading} style={{
      width: '100vw',
      height: '100vh',
    }}>
      <div
        ref={containerRef}
        style={{
          width: '100vw',
          height: '100vh',
          touchAction: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          padding: 20,
        }}
      >
        <Button.Group>
          <Button
            type={currentFloor === 1 ? 'primary' : ''}
            onClick={() => setCurrentFloor(1)}
          >
            一楼
          </Button>
          <Button
            type={currentFloor === 2 ? 'primary' : ''}
            onClick={() => setCurrentFloor(2)}
          >
            二楼
          </Button>
        </Button.Group>
      </div>
      {currentExhibit ? (
        <div
          style={{
            display: currentExhibit ? '' : 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            textAlign: 'center',
            background: '#000',
            userSelect: 'none',
          }}
          onClick={() => setCurrentExhibit('')}
        >
          <img
            alt=""
            src={currentExhibit}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
        </div>
      ) : null}
    </Spin>
  )
}

export default Exhibition;