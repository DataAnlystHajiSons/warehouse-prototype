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
directionalLight.shadow.camera.left = -220;
directionalLight.shadow.camera.right = 220;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;
scene.add(directionalLight);

async function loadWarehouse() {
    const response = await fetch('./warehouses.json');
    const warehouses = await response.json();
    const warehouseConfig = warehouses[warehouseId];

    if (!warehouseConfig) {
        console.error(`Warehouse with id ${warehouseId} not found in warehouses.json`);
        // redirect to selection page
        window.location.href = 'index.html';
        return;
    }

    // Update the title
    const warehouseTitle = document.querySelector('.warehouse-title');
    if (warehouseTitle) {
        warehouseTitle.textContent = warehouseConfig.name;
    }

    createWarehouseModel(warehouseConfig);
    loadBales();
}

function createWarehouseModel(config) {
    const WAREHOUSE_WIDTH = config.width;
    const WAREHOUSE_DEPTH = config.depth;
    const WALL_HEIGHT = 20; // This can also be moved to config if it varies

    // Floor
    const floorGeometry = new THREE.BoxGeometry(WAREHOUSE_WIDTH, 0.2, WAREHOUSE_DEPTH);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    floor.position.y = -0.1;
    scene.add(floor);

    // Walls
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
}

// --- HAY BALE SETUP ---
const BALE_WIDTH = 7; // Corresponds to Length after rotation
const BALE_HEIGHT = 3;
const BALE_DEPTH = 4; // Corresponds to Width after rotation
const MAX_STACK_HEIGHT = 5;
const baleGeometry = new THREE.BoxGeometry(BALE_WIDTH, BALE_HEIGHT, BALE_DEPTH);
const baleMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520 }); // Goldenrod

// Bale orientation constants
const BALE_ORIENTATION = {
    HORIZONTAL: 0, // West-East (default)
    VERTICAL: Math.PI / 2 // North-South
};

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

    // Set initial rotation based on stored orientation or default to horizontal
    const orientation = baleData.orientation !== undefined ? baleData.orientation : BALE_ORIENTATION.HORIZONTAL;
    bale.rotation.y = Math.PI / 2 + orientation;
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
        orientation: orientation,
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

const urlParams = new URLSearchParams(window.location.search);
const warehouseId = urlParams.get('warehouse_id');

if (!warehouseId) {
    window.location.href = 'index.html';
}



async function loadBales() {
    console.log(`Fetching layout for warehouse ${warehouseId} from Supabase...`);
    let { data: balesData, error } = await db
        .from('bales')
        .select('*')
        .eq('warehouse_no', warehouseId);

    if (error) {
        console.error("Error fetching bales:", error);
        // Try to load sample data if database fails
        console.log("Attempting to load sample data...");
        await loadSampleData();
        return;
    }

    if (balesData && balesData.length > 0) {
        console.log("Bales data from Supabase:", balesData);
        console.log("Found", balesData.length, "bales in Supabase.");
        balesData.forEach(baleData => createBale(baleData));
        updateStackCounters(); // Initial creation of stack counters
        populateVehicleDropdown(); // Populate the vehicle filter UI
        populateCpNumberDropdown();
    } else {
        console.log("No bales found in Supabase. Loading sample data...");
        await loadSampleData();
    }
}

async function loadSampleData() {
    if (warehouseId !== '6') {
        console.log("No sample data for this warehouse.");
        return;
    }
    try {
        const response = await fetch('./bales.json');
        const sampleData = await response.json();
        
        console.log("Sample data loaded:", sampleData);
        
        // Convert sample data to proper bale format and insert into database
        const bales = [];
        let baleId = 1;
        
        sampleData.forEach(stack => {
            stack.bales.forEach((bale, index) => {
                const baleData = {
                    id: baleId++,
                    position_x: stack.position.x,
                    position_y: (index * 3) + 1.5, // Stack height
                    position_z: stack.position.z,
                    orientation: 0, // Default horizontal
                    cp_number: bale.cp,
                    vehicle_number: `VEH-${stack.id}`,
                    warehouse_no: warehouseId,
                    arrival_date: '2024-01-15',
                    supplier: 'Sample Supplier',
                    total_weight: '500kg',
                    no_of_bales: stack.bales.length,
                    container_no: `CONT-${stack.id}`
                };
                bales.push(baleData);
            });
        });
        
        // Insert sample data into Supabase
        const { error: insertError } = await db.from('bales').insert(bales);
        
        if (insertError) {
            console.error("Error inserting sample data:", insertError);
            // Create bales anyway for display
            bales.forEach(baleData => createBale(baleData));
        } else {
            console.log("Sample data inserted successfully. Reloading...");
            // Reload from database
            loadBales();
            return;
        }
        
        updateStackCounters();
        populateVehicleDropdown();
        populateCpNumberDropdown();
        
    } catch (fetchError) {
        console.error("Error loading sample data:", fetchError);
    }
}

function filterByVehicle(vehicleAndContainerNo) {
    activeVehicleFilter = vehicleAndContainerNo;

    if (!vehicleAndContainerNo) {
        hideVehicleInfo();
    } else {
        showVehicleInfo(vehicleAndContainerNo);
    }

    applyFilters();
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
            position_z: bale.position.z,
            orientation: bale.userData.orientation
         })
        .eq('id', bale.userData.id);

    if (error) {
        console.error("Error updating bale position:", error);
    } else {
        console.log("Bale position and orientation updated successfully.");
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
const rotateBaleBtn = document.getElementById('rotate-bale-btn');
const keyboardHints = document.querySelector('.keyboard-hints');

const filterPane = document.getElementById('filter-pane');
const toggleFilterPaneBtn = document.getElementById('toggle-filter-pane-btn');
const vehicleSelect = document.getElementById('vehicle-select');
const cpNumberSelect = document.getElementById('cp-number-select');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');

const vehicleInfoBox = document.getElementById('vehicle-info-box');
const vehicleArrivalDateSpan = document.getElementById('vehicle-arrival-date');
const vehicleSupplierSpan = document.getElementById('vehicle-supplier');
const vehicleTotalWeightSpan = document.getElementById('vehicle-total-weight');
const vehicleContainerNoSpan = document.getElementById('vehicle-container-no');
const vehicleWarehouseNoSpan = document.getElementById('vehicle-warehouse-no');
const vehicleNoOfBalesSpan = document.getElementById('vehicle-no-of-bales');

let isolatedStackKey = null;

// --- Filter Pane Logic ---
toggleFilterPaneBtn.addEventListener('click', () => {
    filterPane.classList.toggle('collapsed');
    if (filterPane.classList.contains('collapsed')) {
        toggleFilterPaneBtn.textContent = '<';
    } else {
        toggleFilterPaneBtn.textContent = '>';
    }
});

function populateVehicleDropdown() {
    const vehicleAndContainerNumbers = [...new Set(bales.map(b => {
        if (b.userData.vehicleNumber && b.userData.container_no) {
            return `${b.userData.vehicleNumber} - ${b.userData.container_no}`;
        }
        return null;
    }).filter(Boolean))];

    vehicleAndContainerNumbers.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        vehicleSelect.appendChild(option);
    });
}

function populateCpNumberDropdown() {
    const cpNumberPrefixes = [...new Set(bales.map(b => {
        if (b.userData.cpNumber) {
            return b.userData.cpNumber.split('-')[0].trim();
        }
        return null;
    }).filter(Boolean))];

    cpNumberPrefixes.forEach(prefix => {
        const option = document.createElement('option');
        option.value = prefix;
        option.textContent = prefix;
        cpNumberSelect.appendChild(option);
    });
}

function updateActiveFiltersBadge() {
    const badge = document.getElementById('active-filters-badge');
    let count = 0;
    if (vehicleSelect.value) {
        count++;
    }
    if (cpNumberSelect.value) {
        count++;
    }
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function showVehicleInfo(vehicleAndContainerNo) {
    if (!vehicleAndContainerNo) {
        vehicleInfoBox.style.display = 'none';
        return;
    }

    const [vehicleNo, containerNo] = vehicleAndContainerNo.split(' - ');
    const balesForVehicle = bales.filter(b => b.userData.vehicleNumber === vehicleNo && b.userData.container_no === containerNo);

    if (balesForVehicle.length > 0) {
        const firstBale = balesForVehicle[0];
        vehicleArrivalDateSpan.textContent = firstBale.userData.arrival_date || 'N/A';
        vehicleSupplierSpan.textContent = firstBale.userData.supplier || 'N/A';
        vehicleTotalWeightSpan.textContent = firstBale.userData.total_weight || 'N/A';
        vehicleContainerNoSpan.textContent = firstBale.userData.container_no || 'N/A';
        vehicleWarehouseNoSpan.textContent = firstBale.userData.warehouse_no || 'N/A';
        vehicleNoOfBalesSpan.textContent = balesForVehicle.length;

        vehicleInfoBox.style.display = 'block';
    } else {
        vehicleInfoBox.style.display = 'none';
    }
}

vehicleSelect.addEventListener('change', () => {
    showVehicleInfo(vehicleSelect.value);
});

applyFiltersBtn.addEventListener('click', () => {
    const selectedVehicle = vehicleSelect.value;
    const selectedCpNumber = cpNumberSelect.value;

    bales.forEach(bale => {
        let vehicleMatch = true;
        if (selectedVehicle) {
            const [vehicleNo, containerNo] = selectedVehicle.split(' - ');
            vehicleMatch = bale.userData.vehicleNumber === vehicleNo && bale.userData.container_no === containerNo;
        }

        let cpNumberMatch = true;
        if (selectedCpNumber) {
            if (bale.userData.cpNumber) {
                cpNumberMatch = bale.userData.cpNumber.startsWith(selectedCpNumber);
            } else {
                cpNumberMatch = false;
            }
        }

        bale.visible = vehicleMatch && cpNumberMatch;
    });

    updateStackCounters();
    updateActiveFiltersBadge();
});

clearFiltersBtn.addEventListener('click', () => {
    vehicleSelect.value = '';
    cpNumberSelect.value = '';
    showVehicleInfo(null);

    bales.forEach(bale => {
        bale.visible = true;
    });

    updateStackCounters();
    updateActiveFiltersBadge();
});

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    if (draggedBale) {
        raycaster.setFromCamera(mouse, camera);
        const intersectionPoint = new THREE.Vector3();
        
        if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
            // Determine grid size based on bale orientation
            const isVertical = draggedBale.userData.orientation === BALE_ORIENTATION.VERTICAL;
            // Vertical bales (North-South) use BALE_DEPTH for X-spacing, BALE_WIDTH for Z-spacing
            // Horizontal bales (West-East) use BALE_WIDTH for X-spacing, BALE_DEPTH for Z-spacing
            const snapX = isVertical ? BALE_DEPTH : BALE_WIDTH;
            const snapZ = isVertical ? BALE_WIDTH : BALE_DEPTH;
            
            const snappedX = Math.round(intersectionPoint.x / snapX) * snapX;
            const snappedZ = Math.round(intersectionPoint.z / snapZ) * snapZ;
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

        // Advanced collision detection that properly handles bale orientations
        const draggedIsVertical = draggedBale.userData.orientation === BALE_ORIENTATION.VERTICAL;
        
        // Calculate the dragged bale's footprint dimensions
        const draggedFootprintX = draggedIsVertical ? BALE_DEPTH : BALE_WIDTH;
        const draggedFootprintZ = draggedIsVertical ? BALE_WIDTH : BALE_DEPTH;
        
        const balesAtTarget = otherBales.filter(b => {
            const existingIsVertical = b.userData.orientation === BALE_ORIENTATION.VERTICAL;
            
            // Calculate the existing bale's footprint dimensions
            const existingFootprintX = existingIsVertical ? BALE_DEPTH : BALE_WIDTH;
            const existingFootprintZ = existingIsVertical ? BALE_WIDTH : BALE_DEPTH;
            
            // Check if bales overlap using their actual footprints
            // Two rectangles overlap if they overlap in both X and Z dimensions
            const xOverlap = Math.abs(b.position.x - targetX) < (draggedFootprintX + existingFootprintX) / 2;
            const zOverlap = Math.abs(b.position.z - targetZ) < (draggedFootprintZ + existingFootprintZ) / 2;
            
            return xOverlap && zOverlap;
        });

        console.log(`Checking stacking at position (${targetX}, ${targetZ})`);
        console.log(`Dragged bale orientation: ${draggedIsVertical ? 'Vertical' : 'Horizontal'} (${draggedFootprintX}x${draggedFootprintZ})`);
        console.log(`Found ${balesAtTarget.length} overlapping bales at target position`);
        
        // For proper stacking, we need to find bales that are close enough to stack on
        // This handles cases where different orientations might not have exact position matches
        const stackableBales = balesAtTarget.filter(b => {
            // For stacking, bales should be reasonably close (within half a grid cell)
            const maxStackingDistance = Math.max(BALE_WIDTH, BALE_DEPTH) / 2;
            const distance = Math.sqrt(
                Math.pow(b.position.x - targetX, 2) + 
                Math.pow(b.position.z - targetZ, 2)
            );
            return distance <= maxStackingDistance;
        });

        console.log(`Found ${stackableBales.length} stackable bales (close enough for stacking)`);

        let topBale = null;
        if (stackableBales.length > 0) {
            topBale = stackableBales.reduce((max, b) => b.position.y > max.position.y ? b : max, stackableBales[0]);
            console.log(`Top stackable bale at height: ${topBale.position.y}`);
        }

        let stackHeight = 0;
        if (topBale) {
            stackHeight = Math.round((topBale.position.y + BALE_HEIGHT / 2) / BALE_HEIGHT);
            console.log(`Calculated stack height: ${stackHeight}`);
        }

        if (stackHeight < MAX_STACK_HEIGHT) {
            if (topBale) {
                const newY = topBale.position.y + BALE_HEIGHT;
                console.log(`Stacking bale at height: ${newY}, aligning to position (${topBale.position.x}, ${topBale.position.z})`);
                // Align the dropped bale to the center of the top bale for better stacking
                draggedBale.position.set(topBale.position.x, newY, topBale.position.z);
            } else {
                console.log(`Placing bale on ground at height: ${BALE_HEIGHT / 2}`);
                draggedBale.position.y = BALE_HEIGHT / 2;
            }
            // Save the layout after a successful move
            updateBalePosition(draggedBale).then(() => {
                console.log("Bale position saved successfully");
            }).catch(error => {
                console.error("Failed to save bale position:", error);
            });
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

rotateBaleBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    
    if (selectedBale) {
        // Create smooth rotation animation
        const currentOrientation = selectedBale.userData.orientation;
        const newOrientation = currentOrientation === BALE_ORIENTATION.HORIZONTAL ? 
                               BALE_ORIENTATION.VERTICAL : BALE_ORIENTATION.HORIZONTAL;
        
        // Store the new orientation
        selectedBale.userData.orientation = newOrientation;
        
        // Animate the rotation with a premium feel
        const startRotation = selectedBale.rotation.y;
        const targetRotation = Math.PI / 2 + newOrientation;
        const rotationDuration = 500; // milliseconds
        const startTime = Date.now();
        
        // Add subtle bounce and glow effects during rotation
        selectedBale.material.emissive.setHex(0x2a5aa8); // Blue glow during rotation
        
        function animateRotation() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / rotationDuration, 1);
            
            // Smooth easing function (ease-out-back for premium feel)
            const easeOutBack = (t) => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            };
            
            const easedProgress = easeOutBack(progress);
            selectedBale.rotation.y = startRotation + (targetRotation - startRotation) * easedProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateRotation);
            } else {
                // Animation complete - restore original highlighting
                selectedBale.material.emissive.setHex(0x555555);
                updateBalePosition(selectedBale); // Save to database
                updateStackCounters(); // Update visual counters
                
                // Update button text based on new orientation
                const orientationText = newOrientation === BALE_ORIENTATION.HORIZONTAL ? 
                                       'West-East' : 'North-South';
                rotateBaleBtn.innerHTML = `<span class="rotate-icon">↻</span> Rotate (${orientationText})`;
            }
        }
        
        animateRotation();
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
    keyboardHints.style.display = 'block';
    changePosBtn.style.display = 'block';
    isolateStackBtn.style.display = 'block';
    rotateBaleBtn.style.display = 'block';
    
    // Update rotate button text based on current orientation
    const orientationText = bale.userData.orientation === BALE_ORIENTATION.HORIZONTAL ? 
                           'West-East' : 'North-South';
    rotateBaleBtn.innerHTML = `<span class="rotate-icon">↻</span> Rotate (${orientationText})`;
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
    keyboardHints.style.display = 'none';
    changePosBtn.style.display = 'none';
    isolateStackBtn.style.display = 'none';
    rotateBaleBtn.style.display = 'none';

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

// Add keyboard shortcuts for premium UX
window.addEventListener('keydown', (event) => {
    if (selectedBale && !draggedBale) {
        switch(event.key.toLowerCase()) {
            case 'r':
                event.preventDefault();
                rotateBaleBtn.click();
                break;
            case 'm':
                event.preventDefault();
                changePosBtn.click();
                break;
            case 'i':
                event.preventDefault();
                isolateStackBtn.click();
                break;
            case 'escape':
                if (selectedBale) {
                    selectedBale.material.emissive.setHex(selectedBale.userData.originalEmissive);
                    selectedBale = null;
                    hideInfo();
                }
                break;
        }
    }
});

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
loadWarehouse();
animate();
