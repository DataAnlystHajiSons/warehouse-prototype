import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- SUPABASE SETUP ---
const SUPABASE_URL = 'https://ilruefcoyvibwhrjbkgw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscnVlZmNveXZpYndocmpia2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2OTM0NzAsImV4cCI6MjA3NDI2OTQ3MH0.dT8KFjDbPfHkzZ-8bdxD8_6JxeNfk_HtgBwxTQw9UWk';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const stackCounterPlacards = new Map(); // key: x_z, value: THREE.Object3D

// --- RIBBON COLOR LOGIC ---
const containerColorMap = new Map();
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

// Simple hash function for strings to get a deterministic color index
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function getContainerColor(containerNo) {
    if (!containerNo) {
        return 0x808080; // Return a default color like grey if container_no is null or undefined
    }
    if (!containerColorMap.has(containerNo)) {
        const hash = simpleHash(containerNo);
        const colorIndex = hash % colorPalette.length;
        containerColorMap.set(containerNo, colorPalette[colorIndex]);
    }
    return containerColorMap.get(containerNo);
}

function createBale(baleData) {
    const bale = new THREE.Mesh(baleGeometry, baleMaterial.clone());
    bale.position.set(baleData.position_x, baleData.position_y, baleData.position_z);

    bale.rotation.y = Math.PI / 2;
    bale.castShadow = true;
    bale.receiveShadow = true;

    bale.userData = { 
        id: baleData.id,
        cpNumber: baleData.cp_number, 
        vehicleNumber: baleData.vehicle_number,
        warehouse_no: baleData.warehouse_no,
        arrival_date: baleData.arrival_date,
        supplier: baleData.supplier,
        total_weight: baleData.total_weight,
        no_of_bales: baleData.no_of_bales,
        container_no: baleData.container_no,
        originalEmissive: bale.material.emissive.getHex()
    };

    const ribbonColor = getContainerColor(baleData.container_no);
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
    console.log("Fetching layout from Supabase...");
    let { data: balesData, error } = await db.from('bales').select('*');

    if (error) {
        console.error("Error fetching bales:", error);
        return;
    }

    if (balesData) {
        console.log("Bales data from Supabase:", balesData);
        console.log("Found", balesData.length, "bales in Supabase.");
        balesData.forEach(baleData => createBale(baleData));
        updateStackCounters(); // Initial creation of stack counters
        populateVehicleFilter(); // Populate the vehicle filter UI
    }
}

function filterByVehicle(vehicleAndContainerNo) {
    activeVehicleFilter = vehicleAndContainerNo;

    if (!vehicleAndContainerNo) { // Handles "Show All"
        bales.forEach(bale => bale.visible = true);
        hideVehicleInfo();
    } else {
        const [vehicleNo, containerNo] = vehicleAndContainerNo.split(' - ');
        bales.forEach(bale => {
            bale.visible = bale.userData.vehicleNumber === vehicleNo && bale.userData.container_no === containerNo;
        });
        showVehicleInfo();
    }

    updateStackCounters();
}

function createStackCountCard(count, containerNo) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const text = `${count} Bales`;
    const containerText = `Cont: ${containerNo || 'N/A'}`;

    // Set a higher resolution for the canvas
    const canvasWidth = 180;
    const canvasHeight = 90;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Background
    context.fillStyle = 'rgba(255, 255, 255, 0.8)';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Border
    context.strokeStyle = '#000';
    context.lineWidth = 4;
    context.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Text styling
    context.fillStyle = '#000';
    context.font = 'bold 30px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw text
    context.fillText(text, canvasWidth / 2, canvasHeight / 2 - 15);
    context.font = '24px Arial';
    context.fillText(containerText, canvasWidth / 2, canvasHeight / 2 + 20);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const geometry = new THREE.PlaneGeometry(7, 3.5);
    const card = new THREE.Mesh(geometry, material);

    // Make sure the card always faces the camera
    card.lookAt(camera.position);

    return card;
}

function updateStackCounters() {
    // Clear existing placards
    stackCounterPlacards.forEach(placard => scene.remove(placard));
    stackCounterPlacards.clear();

    // Group bales by stack (only visible bales)
    const stacks = new Map();
    const visibleBales = bales.filter(b => b.visible);
    visibleBales.forEach(bale => {
        const key = `${bale.position.x}_${bale.position.z}`;
        if (!stacks.has(key)) {
            stacks.set(key, []);
        }
        stacks.get(key).push(bale);
    });

    // Create placards for each stack
    stacks.forEach(stackBales => {
        const count = stackBales.length;
        if (count > 0) {
            const topBale = stackBales.reduce((max, b) => b.position.y > max.position.y ? b : max, stackBales[0]);
            const containerNo = topBale.userData.container_no;
            const placard = createStackCountCard(count, containerNo);
            placard.position.set(topBale.position.x, topBale.position.y + BALE_HEIGHT * 1.2, topBale.position.z);
            
            const key = `${topBale.position.x}_${topBale.position.z}`;
            stackCounterPlacards.set(key, placard);
            scene.add(placard);
        }
    });
}


async function updateBalePosition(bale) {
    console.log(`Updating bale ${bale.userData.id} in Supabase...`);
    const { error } = await db
        .from('bales')
        .update({ 
            position_x: bale.position.x,
            position_y: bale.position.y,
            position_z: bale.position.z
         })
        .eq('id', bale.userData.id);

    if (error) {
        console.error("Error updating bale position:", error);
    } else {
        console.log("Bale position updated successfully.");
    }
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
const warehouseNoSpan = document.getElementById('warehouse-no');
const arrivalDateSpan = document.getElementById('arrival-date');
const supplierSpan = document.getElementById('supplier');
const totalWeightSpan = document.getElementById('total-weight');
const noOfBalesSpan = document.getElementById('no-of-bales');
const containerNoSpan = document.getElementById('container-no');
const defaultInfoText = infoBox.querySelector('em');
const changePosBtn = document.getElementById('change-position-btn');
const isolateStackBtn = document.getElementById('isolate-stack-btn');

const vehicleInfoBox = document.getElementById('vehicle-info-box');
const vehicleArrivalDateSpan = document.getElementById('vehicle-arrival-date');
const vehicleSupplierSpan = document.getElementById('vehicle-supplier');
const vehicleTotalWeightSpan = document.getElementById('vehicle-total-weight');
const vehicleContainerNoSpan = document.getElementById('vehicle-container-no');
const vehicleWarehouseNoSpan = document.getElementById('vehicle-warehouse-no');
const vehicleNoOfBalesSpan = document.getElementById('vehicle-no-of-bales');

let isolatedStackKey = null;
let activeVehicleFilter = null;

function showVehicleInfo() {
    const visibleBales = bales.filter(b => b.visible);
    if (visibleBales.length > 0) {
        const firstBale = visibleBales[0];
        vehicleArrivalDateSpan.textContent = firstBale.userData.arrival_date || 'N/A';
        vehicleSupplierSpan.textContent = firstBale.userData.supplier || 'N/A';
        vehicleTotalWeightSpan.textContent = firstBale.userData.total_weight || 'N/A';
        vehicleContainerNoSpan.textContent = firstBale.userData.container_no || 'N/A';
        vehicleWarehouseNoSpan.textContent = firstBale.userData.warehouse_no || 'N/A';
        vehicleNoOfBalesSpan.textContent = visibleBales.length;

        vehicleInfoBox.style.display = 'block';
    }
}

function hideVehicleInfo() {
    vehicleInfoBox.style.display = 'none';
}

function populateVehicleFilter() {
    const vehicleList = document.getElementById('vehicle-list');
    const vehicleAndContainerNumbers = [...new Set(bales.map(b => {
        if (b.userData.vehicleNumber && b.userData.container_no) {
            return `${b.userData.vehicleNumber} - ${b.userData.container_no}`;
        }
        return null;
    }).filter(Boolean))];

    // Add "Show All" option
    const showAllLi = document.createElement('li');
    showAllLi.textContent = 'Show All';
    showAllLi.classList.add('active');
    showAllLi.addEventListener('click', () => {
        filterByVehicle(null);
        document.querySelectorAll('#vehicle-list li').forEach(li => li.classList.remove('active'));
        showAllLi.classList.add('active');
    });
    vehicleList.appendChild(showAllLi);

    // Add vehicle and container numbers
    vehicleAndContainerNumbers.forEach(vehicleAndContainerNo => {
        const li = document.createElement('li');
        li.textContent = vehicleAndContainerNo;
        li.addEventListener('click', () => {
            filterByVehicle(vehicleAndContainerNo);
            document.querySelectorAll('#vehicle-list li').forEach(li => li.classList.remove('active'));
            li.classList.add('active');
        });
        vehicleList.appendChild(li);
    });
}

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
            updateBalePosition(draggedBale); // Save the layout after a successful move
        } else {
            console.log("Stack is full! Reverting position.");
            draggedBale.position.copy(originalPosition);
        }

        updateStackCounters(); // Update counters after move

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

isolateStackBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (selectedBale) {
        const stackKey = `${selectedBale.position.x}_${selectedBale.position.z}`;
        toggleIsolation(stackKey);
    }
});

function toggleIsolation(stackKey) {
    if (isolatedStackKey === stackKey) {
        // Disable isolation
        isolatedStackKey = null;
        isolateStackBtn.textContent = 'Isolate Stack';
        isolateStackBtn.style.backgroundColor = '#17a2b8';
        bales.forEach(b => b.visible = true);
        stackCounterPlacards.forEach(p => p.visible = true);
    } else {
        // Enable isolation
        isolatedStackKey = stackKey;
        isolateStackBtn.textContent = 'Show All Stacks';
        isolateStackBtn.style.backgroundColor = '#28a745';
        bales.forEach(bale => {
            const currentStackKey = `${bale.position.x}_${bale.position.z}`;
            bale.visible = currentStackKey === stackKey;
        });
        stackCounterPlacards.forEach((placard, key) => {
            placard.visible = key === stackKey;
        });
    }
}

function showInfo(bale) {
    cpNumberSpan.textContent = bale.userData.cpNumber || 'N/A';
    vehicleNumberSpan.textContent = bale.userData.vehicleNumber || 'N/A';
    warehouseNoSpan.textContent = bale.userData.warehouse_no || 'N/A';
    arrivalDateSpan.textContent = bale.userData.arrival_date || 'N/A';
    supplierSpan.textContent = bale.userData.supplier || 'N/A';
    totalWeightSpan.textContent = bale.userData.total_weight || 'N/A';
    noOfBalesSpan.textContent = bale.userData.no_of_bales || 'N/A';
    containerNoSpan.textContent = bale.userData.container_no || 'N/A';
    defaultInfoText.style.display = 'none';
    changePosBtn.style.display = 'block';
    isolateStackBtn.style.display = 'block';
}

function hideInfo() {
    cpNumberSpan.textContent = 'N/A';
    vehicleNumberSpan.textContent = 'N/A';
    warehouseNoSpan.textContent = 'N/A';
    arrivalDateSpan.textContent = 'N/A';
    supplierSpan.textContent = 'N/A';
    totalWeightSpan.textContent = 'N/A';
    noOfBalesSpan.textContent = 'N/A';
    containerNoSpan.textContent = 'N/A';
    defaultInfoText.style.display = 'block';
    changePosBtn.style.display = 'none';
    isolateStackBtn.style.display = 'none';

    if (isolatedStackKey) {
        toggleIsolation(isolatedStackKey); // This will disable isolation
    }
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

    // Make placards face the camera
    stackCounterPlacards.forEach(placard => {
        placard.lookAt(camera.position);
    });

    renderer.render(scene, camera);
}

// --- INITIALIZATION ---
loadBales();
animate();
