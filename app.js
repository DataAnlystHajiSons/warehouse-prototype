import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// --- CAMERA ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 100);

// --- RENDERER ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- CONTROLS ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1; // Prevent camera from going under the floor

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(-100, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.left = -200;
directionalLight.shadow.camera.right = 200;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;
scene.add(directionalLight);

// --- WAREHOUSE MODEL ---
const WAREHOUSE_WIDTH = 170;
const WAREHOUSE_DEPTH = 40;

// Floor
const floorGeometry = new THREE.BoxGeometry(WAREHOUSE_WIDTH, 0.2, WAREHOUSE_DEPTH);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.receiveShadow = true;
floor.position.y = -0.1;
scene.add(floor);

// Walls
const WALL_HEIGHT = 20;
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f7f7 });

const wallBack = new THREE.Mesh(
    new THREE.BoxGeometry(WAREHOUSE_WIDTH, WALL_HEIGHT, 0.5),
    wallMaterial
);
wallBack.position.set(0, WALL_HEIGHT / 2 - 0.1, -WAREHOUSE_DEPTH / 2);
wallBack.receiveShadow = true;
scene.add(wallBack);

const wallFront = new THREE.Mesh(
    new THREE.BoxGeometry(WAREHOUSE_WIDTH, WALL_HEIGHT, 0.5),
    wallMaterial
);
wallFront.position.set(0, WALL_HEIGHT / 2 - 0.1, WAREHOUSE_DEPTH / 2);
wallFront.receiveShadow = true;
// scene.add(wallFront); // Commented out for better visibility

// Left wall with gates
const leftWallZPositions = [-12.5, 0, 12.5];
const leftWallZSizes = [5, 15, 5];
leftWallZPositions.forEach((zPos, i) => {
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, WALL_HEIGHT, leftWallZSizes[i]),
        wallMaterial
    );
    wall.position.set(-WAREHOUSE_WIDTH / 2, WALL_HEIGHT / 2 - 0.1, zPos);
    wall.receiveShadow = true;
    scene.add(wall);
});

const wallRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, WALL_HEIGHT, WAREHOUSE_DEPTH),
    wallMaterial
);
wallRight.position.set(WAREHOUSE_WIDTH / 2, WALL_HEIGHT / 2 - 0.1, 0);
wallRight.receiveShadow = true;
scene.add(wallRight);

// --- HAY BALE SETUP ---
const BALE_WIDTH = 7; // Corresponds to Length after rotation
const BALE_HEIGHT = 3;
const BALE_DEPTH = 4; // Corresponds to Width after rotation
const MAX_STACK_HEIGHT = 5;
const baleGeometry = new THREE.BoxGeometry(BALE_WIDTH, BALE_HEIGHT, BALE_DEPTH);
const baleMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520 }); // Goldenrod

const bales = [];

// --- RIBBON COLOR LOGIC ---
const cpColorMap = new Map();
const colorPalette = [
    0xff0000, // Red
    0x00ff00, // Green
    0x0000ff, // Blue
    0xffff00, // Yellow
    0xff00ff, // Magenta
    0x00ffff, // Cyan
    0xffa500, // Orange
    0x800080, // Purple
    0x008000, // Dark Green
    0x800000, // Maroon
];
let nextColorIndex = 0;

function getCpColor(cpPrefix) {
    if (!cpColorMap.has(cpPrefix)) {
        cpColorMap.set(cpPrefix, colorPalette[nextColorIndex % colorPalette.length]);
        nextColorIndex++;
    }
    return cpColorMap.get(cpPrefix);
}

function createBale(baleData, position) {
    const bale = new THREE.Mesh(baleGeometry, baleMaterial.clone());
    bale.position.copy(position);

    bale.rotation.y = Math.PI / 2;
    bale.castShadow = true;
    bale.receiveShadow = true;

    bale.userData = { 
        cpNumber: baleData.cp, 
        vehicleNumber: 'N/A',
        originalEmissive: bale.material.emissive.getHex()
    };

    const cpPrefix = baleData.cp.split('-')[0];
    const ribbonColor = getCpColor(cpPrefix);
    const ribbonHeight = 0.5;
    const ribbonGeometry = new THREE.BoxGeometry(BALE_WIDTH + 0.02, ribbonHeight, BALE_DEPTH + 0.02);
    const ribbonMaterial = new THREE.MeshBasicMaterial({ color: ribbonColor });
    const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    ribbon.position.y = 0;
    bale.add(ribbon);

    bales.push(bale);
    scene.add(bale);
}

async function loadBales() {
    const savedLayout = localStorage.getItem('warehouseLayout');

    let layoutData;
    if (savedLayout) {
        console.log("Found saved layout in localStorage. Loading...");
        layoutData = JSON.parse(savedLayout);
    } else {
        console.log("No saved layout found. Loading from bales.json...");
        const response = await fetch('bales.json');
        layoutData = await response.json();
    }

    layoutData.forEach(stackData => {
        stackData.bales.forEach((baleData, index) => {
            const position = new THREE.Vector3(
                stackData.position.x,
                (index * BALE_HEIGHT) + (BALE_HEIGHT / 2),
                stackData.position.z
            );
            createBale(baleData, position);
        });
    });
}

function saveLayout() {
    console.log("Saving layout to localStorage...");
    const stacksMap = new Map();

    bales.forEach(bale => {
        const key = `${bale.position.x},${bale.position.z}`;
        if (!stacksMap.has(key)) {
            stacksMap.set(key, []);
        }
        stacksMap.get(key).push(bale);
    });

    const layoutData = [];
    for (const stackBales of stacksMap.values()) {
        stackBales.sort((a, b) => a.position.y - b.position.y);

        const pos = stackBales[0].position;
        layoutData.push({
            id: layoutData.length + 1,
            position: { x: pos.x, z: pos.z },
            bales: stackBales.map(b => ({ cp: b.userData.cpNumber }))
        });
    }

    localStorage.setItem('warehouseLayout', JSON.stringify(layoutData));
    console.log("Layout saved.");
}

// --- INTERACTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedBale = null;
let draggedBale = null;
let originalPosition = new THREE.Vector3();

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// UI Elements
const infoBox = document.getElementById('info-box');
const cpNumberSpan = document.getElementById('cp-number');
const vehicleNumberSpan = document.getElementById('vehicle-number');
const defaultInfoText = infoBox.querySelector('em');
const changePosBtn = document.getElementById('change-position-btn');
const resetLayoutBtn = document.getElementById('reset-layout-btn');

resetLayoutBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset the layout? All changes will be lost.")) {
        localStorage.removeItem('warehouseLayout');
        location.reload();
    }
});

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    if (draggedBale) {
        raycaster.setFromCamera(mouse, camera);
        const intersectionPoint = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
            const snappedX = Math.round(intersectionPoint.x / BALE_DEPTH) * BALE_DEPTH;
            const snappedZ = Math.round(intersectionPoint.z / BALE_WIDTH) * BALE_WIDTH;
            draggedBale.position.x = snappedX;
            draggedBale.position.z = snappedZ;
        }
    }
}

function onMouseClick(event) {
    raycaster.setFromCamera(mouse, camera);

    if (draggedBale) {
        // --- DROPPING A BALE ---
        const otherBales = bales.filter(b => b.uuid !== draggedBale.uuid);
        const targetX = draggedBale.position.x;
        const targetZ = draggedBale.position.z;

        const balesAtTarget = otherBales.filter(b => 
            Math.abs(b.position.x - targetX) < 0.1 && Math.abs(b.position.z - targetZ) < 0.1
        );

        let topBale = null;
        if (balesAtTarget.length > 0) {
            topBale = balesAtTarget.reduce((max, b) => b.position.y > max.position.y ? b : max, balesAtTarget[0]);
        }

        let stackHeight = 0;
        if (topBale) {
            stackHeight = Math.round((topBale.position.y + BALE_HEIGHT / 2) / BALE_HEIGHT);
        }

        if (stackHeight < MAX_STACK_HEIGHT) {
            if (topBale) {
                draggedBale.position.set(topBale.position.x, topBale.position.y + BALE_HEIGHT, topBale.position.z);
            } else {
                draggedBale.position.y = BALE_HEIGHT / 2;
            }
            saveLayout(); // Save the layout after a successful move
        } else {
            console.log("Stack is full! Reverting position.");
            draggedBale.position.copy(originalPosition);
        }

        draggedBale.material.emissive.setHex(draggedBale.userData.originalEmissive);
        draggedBale = null;
        selectedBale = null;
        controls.enabled = true;
        hideInfo();

    } else {
        // --- SELECTING A BALE ---
        const intersects = raycaster.intersectObjects(bales, true);

        if (intersects.length > 0) {
            let intersectedObject = intersects[0].object;
            let clickedBale = null;
            while (intersectedObject) {
                if (bales.includes(intersectedObject)) {
                    clickedBale = intersectedObject;
                    break;
                }
                intersectedObject = intersectedObject.parent;
            }

            if (clickedBale) {
                if (selectedBale && selectedBale.uuid !== clickedBale.uuid) {
                    selectedBale.material.emissive.setHex(selectedBale.userData.originalEmissive);
                }
                
                selectedBale = clickedBale;
                selectedBale.material.emissive.setHex(0x555555);
                
                showInfo(selectedBale);
            }
        } else {
            if (selectedBale) {
                selectedBale.material.emissive.setHex(selectedBale.userData.originalEmissive);
                selectedBale = null;
            }
            hideInfo();
        }
    }
}

changePosBtn.addEventListener('click', (event) => {
    event.stopPropagation();

    if (selectedBale) {
        draggedBale = selectedBale;
        originalPosition.copy(draggedBale.position);
        
        draggedBale.position.y += BALE_HEIGHT * 0.5;
        dragPlane.set(new THREE.Vector3(0, 1, 0), -draggedBale.position.y);

        draggedBale.material.emissive.setHex(0xcc6600);
        controls.enabled = false;
        
        changePosBtn.style.display = 'none';
    }
});

function showInfo(bale) {
    cpNumberSpan.textContent = bale.userData.cpNumber;
    vehicleNumberSpan.textContent = bale.userData.vehicleNumber;
    defaultInfoText.style.display = 'none';
    changePosBtn.style.display = 'block';
}

function hideInfo() {
    cpNumberSpan.textContent = 'N/A';
    vehicleNumberSpan.textContent = 'N/A';
    defaultInfoText.style.display = 'block';
    changePosBtn.style.display = 'none';
}

// --- RESIZE HANDLING ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);
window.addEventListener('click', onMouseClick);
window.addEventListener('mousemove', onMouseMove);

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- INITIALIZATION ---
loadBales();
animate();
