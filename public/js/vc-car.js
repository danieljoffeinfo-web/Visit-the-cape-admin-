import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

(function initVcCarScroll() {
  if (window.__VC_CAR_INIT) return;
  window.__VC_CAR_INIT = true;

  var CAR_SRC = document.currentScript?.dataset?.car || '/images/v-class-top.webp';
  var destSection = document.getElementById('destinations');
  if (!destSection) return;

  var firstItem = destSection.querySelector('.dest-item');
  if (!firstItem) return;

  var stage = document.createElement('div');
  stage.id = 'vc-car-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:24;opacity:0;transition:opacity .4s ease';
  document.body.appendChild(stage);

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  camera.position.z = 5;

  var carGroup = new THREE.Group();
  scene.add(carGroup);

  var carMesh = null;
  var shadowMesh = null;
  var carScale = 1;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.left = 0;
    camera.right = w;
    camera.top = 0;
    camera.bottom = h;
    camera.updateProjectionMatrix();
    carScale = Math.min(w, h) * (w <= 900 ? 0.22 : 0.16);
  }

  function scrollMetrics() {
    var intro = destSection.querySelector('.dest-intro');
    var introTop = intro ? intro.offsetTop : destSection.offsetTop;
    var itemTop = firstItem.offsetTop;
    var itemHeight = firstItem.offsetHeight;
    var start = introTop + window.innerHeight * 0.05;
    var end = itemTop + itemHeight * 0.58;
    var range = Math.max(end - start, 1);
    var t = (window.scrollY - start) / range;
    return { t: Math.min(1, Math.max(0, t)), active: window.scrollY >= start - 100 && window.scrollY <= end + 160 };
  }

  function pathPoint(t) {
    var itemRect = firstItem.getBoundingClientRect();
    var w = window.innerWidth;
    var h = window.innerHeight;

    /* Start: left image — cursor 1 (~22% across, ~34% down the row) */
    var startX = itemRect.left + itemRect.width * 0.24;
    var startY = itemRect.top + itemRect.height * 0.36;

    /* End: right dark column — cursor 2 (~68% across, ~26% down) */
    var endX = itemRect.left + itemRect.width * 0.68;
    var endY = itemRect.top + itemRect.height * 0.26;

    var e = easeInOutCubic(t);
    return {
      x: startX + (endX - startX) * e,
      y: startY + (endY - startY) * e,
      rot: -Math.PI / 2 + (endX - startX) * 0.0008,
      scale: 0.88 + e * 0.08,
    };
  }

  function renderFrame() {
    requestAnimationFrame(renderFrame);
    if (!carMesh) return;

    var metrics = scrollMetrics();
    stage.style.opacity = metrics.active ? '1' : '0';

    if (!metrics.active) return;

    var p = pathPoint(metrics.t);
    carGroup.position.set(p.x, p.y, 0);
    carGroup.rotation.z = p.rot;
    carGroup.scale.setScalar(p.scale);

    var fadeEdge = 0.06;
    var alpha = 1;
    if (metrics.t < fadeEdge) alpha = metrics.t / fadeEdge;
    else if (metrics.t > 1 - fadeEdge) alpha = (1 - metrics.t) / fadeEdge;
    carMesh.material.opacity = alpha;
    shadowMesh.material.opacity = alpha * 0.42;

    renderer.render(scene, camera);
  }

  new THREE.TextureLoader().load(CAR_SRC, function (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    var aspect = tex.image.width / tex.image.height;
    var width = carScale;
    var height = width / aspect;

    var carGeo = new THREE.PlaneGeometry(width, height);
    var carMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    carMesh = new THREE.Mesh(carGeo, carMat);
    carMesh.position.z = 0.02;
    carGroup.add(carMesh);

    var shadowGeo = new THREE.PlaneGeometry(width * 0.78, width * 0.34);
    var shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0, height * 0.08, 0);
    carGroup.add(shadowMesh);

    resize();
    renderFrame();
  });

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', function () {}, { passive: true });
})();
