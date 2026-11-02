import * as THREE from '../vendor/three.module.js';

export class RicardoAvatar3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.avatarGroup = null;
    this.headGroup = null;
    this.avatarMesh = null;
    this.particles = null;
    this.auraMesh = null;

    // Estados e dinâmicas
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.lipSyncValue = 0;
    this.targetLipSync = 0;
    this.blinkProgress = 0;
    this.blinkTimer = 0;
    this.nextBlinkInterval = 3.5;
    this.isBlinking = false;
    this.isSpeaking = false;
    this.clock = new THREE.Clock();

    // Micro-expressões e olhar frontal
    this.saccadeTimer = 0;
    this.saccadeOffset = { x: 0, y: 0 };
    this.nodAmount = 0;

    // Arrays para deformação e articulação de vértices anatômicos
    this.basePositions = null;
    this.mouthVertices = [];
    this.eyeVertices = [];
    this.browVertices = [];
    this.chinVertices = [];

    // Dinâmicas de corpo e postura expressiva
    this.currentBodyLean = 0;
    this.targetBodyLean = 0;
    this.acknowledgementTimer = 0;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Cena
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a090d, 0.06);

    // Câmera frontal e intimista
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4.4);

    // Renderizador WebGL de alta fidelidade
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.container.appendChild(this.renderer.domElement);

    // Iluminação cinematográfica quente e acolhedora
    this.setupLighting();

    // Grupos para hierarquia de movimento 3D (corpo e cabeça)
    this.avatarGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.avatarGroup.add(this.headGroup);
    this.scene.add(this.avatarGroup);

    // Carregar Avatar esculpido em 3D a partir da foto
    this.createRicardoSculpt();

    // Partículas de luz ambiente (bokeh dourado flutuante)
    this.createAtmosphericParticles();

    // Halo/Aura sutil de serenidade e presença
    this.createAura();

    // Interatividade: olhar segue o utilizador de forma frontal e suave
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });

    // Iniciar loop de renderização 60fps
    this.animate();
  }

  setupLighting() {
    // 1. Luz ambiente difusa quente
    const ambientLight = new THREE.AmbientLight(0xffebd2, 1.35);
    this.scene.add(ambientLight);

    // 2. Luz Principal (Key Light) dourada/solar - ilumina a face frontal e revela os relevos 3D
    const keyLight = new THREE.DirectionalLight(0xffdfa8, 2.0);
    keyLight.position.set(2.0, 2.2, 3.8);
    this.scene.add(keyLight);

    // 3. Luz de Preenchimento suave (Fill Light) para sombras suaves
    const fillLight = new THREE.DirectionalLight(0xe5b880, 0.9);
    fillLight.position.set(-2.2, 1.2, 3.0);
    this.scene.add(fillLight);

    // 4. Luz de Recorte (Rim Light) - realça o cabelo ondulado e ombros
    const rimLightLeft = new THREE.DirectionalLight(0xf59e0b, 1.8);
    rimLightLeft.position.set(-3.5, 2.8, -2.5);
    this.scene.add(rimLightLeft);

    const rimLightRight = new THREE.DirectionalLight(0xdf8d1a, 1.4);
    rimLightRight.position.set(3.5, 2.2, -2.2);
    this.scene.add(rimLightRight);

    // 5. Ponto de luz quente no peito/queixo
    const chestGlow = new THREE.PointLight(0xf7d299, 0.8, 8);
    chestGlow.position.set(0, -1.2, 2.0);
    this.scene.add(chestGlow);
  }

  createRicardoSculpt() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      './ricardo.jpg',
      (texture) => {
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;

        // Proporção anatômica exata da imagem original (1024 x 571 = 1.793:1)
        // Isso garante ZERO distorção ou estiramento facial.
        const width = 5.38;
        const height = 3.0;
        const segX = 160;
        const segY = 160;

        const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
        const posAttr = geometry.attributes.position;
        const count = posAttr.count;

        this.mouthVertices = [];
        this.eyeVertices = [];
        this.browVertices = [];

        // Escultura 3D Anatômica: nariz, maçãs do rosto, olhos, queixo, barba, cabelos e manto
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          let z = 0;

          // 1. Curvatura básica esferoidal do busto e crânio
          const distFromCenter = Math.sqrt(x * x * 1.35 + (y - 0.2) * (y - 0.2));
          if (distFromCenter < 1.8) {
            z += Math.max(0, 0.52 - distFromCenter * 0.28);
          }

          // 2. Projeção tridimensional do nariz (ponte, dorso e ponta anatômica)
          // No sistema 16:9: centro do nariz em x: 0.0, y: [0.0, 0.35]
          const noseDist = Math.sqrt(x * x * 5.0 + (y - 0.12) * (y - 0.12));
          if (noseDist < 0.32) {
            z += Math.cos((noseDist / 0.32) * Math.PI * 0.5) * 0.35;
          }

          // 3. Maçãs do rosto (Zygomatic) e bochechas
          if (y > -0.15 && y < 0.55 && Math.abs(x) > 0.18 && Math.abs(x) < 0.72) {
            const cheekDist = Math.sqrt(Math.pow(Math.abs(x) - 0.42, 2) + Math.pow(y - 0.22, 2));
            if (cheekDist < 0.38) {
              z += Math.cos((cheekDist / 0.38) * Math.PI * 0.5) * 0.16;
            }
          }

          // 4. Órbitas oculares e cavidades dos olhos (indentações suaves)
          // Olhos em x: ±0.26, y: 0.40
          const leftEyeDist = Math.sqrt(Math.pow(x + 0.26, 2) + Math.pow(y - 0.40, 2) * 1.8);
          const rightEyeDist = Math.sqrt(Math.pow(x - 0.25, 2) + Math.pow(y - 0.40, 2) * 1.8);
          const minEyeDist = Math.min(leftEyeDist, rightEyeDist);
          if (minEyeDist < 0.22) {
            // Cavidade orbital
            z -= (1.0 - minEyeDist / 0.22) * 0.06;
          }

          // 5. Sobrancelhas e testa
          if (y > 0.50 && y < 0.95 && Math.abs(x) < 0.75) {
            z += 0.12 * Math.cos(x * 1.6);
          }

          // 6. Lábios, queixo e volume da barba
          // Boca em y: [-0.42, -0.25], x: [-0.22, 0.22]
          const mouthDist = Math.sqrt(x * x * 3.2 + Math.pow(y - (-0.34), 2));
          if (mouthDist < 0.28) {
            z += Math.cos((mouthDist / 0.28) * Math.PI * 0.5) * 0.12;
          }

          // Queixo e barba volumosa
          const chinDist = Math.sqrt(x * x * 2.8 + Math.pow(y - (-0.68), 2));
          if (chinDist < 0.35) {
            z += Math.cos((chinDist / 0.35) * Math.PI * 0.5) * 0.22;
          }

          // 7. Pescoço (recua no espaço 3D para trás da mandíbula)
          if (y < -0.65 && y > -1.05 && Math.abs(x) < 0.48) {
            z -= 0.14;
          }

          // 8. Ombros e manto de linho (recuo natural e declive)
          if (y < -0.9) {
            z += 0.06 - (Math.abs(x) * 0.12);
          }

          // 9. Camadas de cabelo ondulado nas laterais
          if (Math.abs(x) > 0.65 && Math.abs(x) < 1.35 && y > -0.6 && y < 0.85) {
            z += 0.10 * Math.sin(y * 4.0 + x * 2.0);
          }

          posAttr.setZ(i, z);

          // Mapear Vértices da Boca para Sincronização Labial (Lip-Sync anatômico)
          if (Math.abs(x) < 0.28 && y > -0.46 && y < -0.22) {
            const weightX = 1 - Math.abs(x) / 0.28;
            const weightY = 1 - Math.abs(y - (-0.34)) / 0.12;
            const weight = Math.max(0, weightX * weightY);
            if (weight > 0.02) {
              const isLowerLip = y <= -0.34;
              this.mouthVertices.push({
                index: i,
                weight,
                baseX: x,
                baseY: y,
                baseZ: z,
                isLowerLip,
              });
            }
          }

          // Mapear Vértices do Maxilar e Barba (para que a mandíbula acompanhe a fala)
          if (y <= -0.44 && y > -0.82 && Math.abs(x) < 0.38) {
            const chinWeight = Math.max(0, 1 - Math.abs(y - (-0.58)) / 0.22) * Math.max(0, 1 - Math.abs(x) / 0.38);
            if (chinWeight > 0.03) {
              this.chinVertices.push({
                index: i,
                weight: chinWeight,
                baseX: x,
                baseY: y,
                baseZ: z,
              });
            }
          }

          // Mapear Vértices das Sobrancelhas para Expressividade na Fala
          if (y > 0.50 && y < 0.76 && Math.abs(x) < 0.65) {
            const browWeight = Math.max(0, 1 - Math.abs(y - 0.62) / 0.13) * Math.max(0, 1 - Math.abs(x) / 0.65);
            if (browWeight > 0.04) {
              this.browVertices.push({
                index: i,
                weight: browWeight,
                baseY: y,
                baseZ: z,
              });
            }
          }

          // Mapear Vértices dos Olhos para Piscar Realista e Sorriso com os Olhos
          if (y > 0.32 && y < 0.48 && (Math.abs(x) > 0.14 && Math.abs(x) < 0.40)) {
            const eyeWeight = 1 - Math.abs(y - 0.40) / 0.09;
            if (eyeWeight > 0.05) {
              this.eyeVertices.push({
                index: i,
                weight: Math.max(0, eyeWeight),
                baseY: y,
                baseZ: z,
              });
            }
          }
        }

        geometry.computeVertexNormals();

        // Armazenar malha de repouso para animações
        this.basePositions = new Float32Array(posAttr.array);

        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.52,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });

        this.avatarMesh = new THREE.Mesh(geometry, material);
        this.avatarMesh.position.set(0, -0.05, 0);
        this.headGroup.add(this.avatarMesh);
      },
      undefined,
      (err) => {
        console.error('Erro ao carregar imagem do Ricardo:', err);
      }
    );
  }

  createAtmosphericParticles() {
    const count = 160;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9.0;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4.0 - 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xf5d08a,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  createAura() {
    const geometry = new THREE.RingGeometry(1.8, 3.2, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0xe2a855,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.auraMesh = new THREE.Mesh(geometry, material);
    this.auraMesh.position.set(0, 0.15, -0.8);
    this.headGroup.add(this.auraMesh);
  }

  onPointerMove(event) {
    this.mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  onTouchMove(event) {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      this.mouse.targetX = (touch.clientX / window.innerWidth) * 2 - 1;
      this.mouse.targetY = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
  }

  onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  triggerAcknowledge() {
    this.acknowledgementTimer = 0.7; // Suave assentimento reflexivo ao receber mensagem
  }

  setLipSync(amplitude) {
    this.targetLipSync = Math.min(1.0, Math.max(0, amplitude));
    this.isSpeaking = this.targetLipSync > 0.035;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Damping suave do olhar para contato visual direto e frontal ("olhos nos olhos")
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.045;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.045;

    // 2. Micro-sacadas oculares humanas (olhar atento, vivo e pensativo)
    this.saccadeTimer += delta;
    if (this.saccadeTimer > 2.8) {
      this.saccadeTimer = 0;
      this.saccadeOffset.x = (Math.random() - 0.5) * 0.009;
      this.saccadeOffset.y = (Math.random() - 0.5) * 0.006;
    }

    // 3. Postura e Movimentos Corporais Vivos (Peito, Ombros e Busto)
    if (this.avatarGroup) {
      // Inclinação corporal conversacional: ao falar, aproxima-se com empatia e autoridade fraterna
      this.targetBodyLean = this.isSpeaking ? 0.08 : 0.0;
      this.currentBodyLean += (this.targetBodyLean - this.currentBodyLean) * 0.06;
      this.avatarGroup.position.z = this.currentBodyLean;
      this.avatarGroup.rotation.x = this.isSpeaking ? 0.022 : 0.0;

      // Micro-oscilação natural do corpo (balanço involuntário do tronco)
      const torsoSwayX = Math.sin(time * 0.45) * 0.014;
      const torsoSwayRoll = Math.sin(time * 0.45) * 0.007;
      this.avatarGroup.position.x = torsoSwayX;
      this.avatarGroup.rotation.z = torsoSwayRoll;

      // Respiração orgânica multidimensional (elevação e expansão torácica)
      const breathing = Math.sin(time * 1.3) * 0.022;
      const breathExpand = Math.cos(time * 1.3) * 0.012;
      this.avatarGroup.position.y = breathing;
      this.avatarGroup.scale.set(
        1.0 + breathExpand,
        1.0 + breathing * 0.7,
        1.0 + breathExpand
      );
    }

    // 4. Gestos Naturais de Cabeça durante a Fala e Escuta Atenta
    if (this.headGroup) {
      const gazeY = this.mouse.x * 0.18 + this.saccadeOffset.x;
      const gazeX = -this.mouse.y * 0.10 + this.saccadeOffset.y;

      // Gestos comunicativos durante a fala (inflexões orais, ênfase de ideias e pausas)
      const speechNod = (Math.sin(time * 3.6) * 0.035 + Math.sin(time * 1.8) * 0.02) * this.lipSyncValue;
      const speechTilt = Math.sin(time * 2.2) * 0.024 * this.lipSyncValue;
      const speechTurn = Math.cos(time * 1.4) * 0.026 * this.lipSyncValue;
      const headLean = 0.02 * this.lipSyncValue;

      // Postura atenta quando está em silêncio (ouvindo ou refletindo)
      const listeningTilt = Math.sin(time * 0.55) * 0.012;
      const breathingNod = Math.sin(time * 1.1) * 0.008;

      // Assentimento consciente quando o usuário envia uma reflexão
      let ackNod = 0;
      if (this.acknowledgementTimer > 0) {
        this.acknowledgementTimer = Math.max(0, this.acknowledgementTimer - delta);
        const ackProgress = (0.7 - this.acknowledgementTimer) / 0.7;
        ackNod = Math.sin(ackProgress * Math.PI) * 0.045;
      }

      this.headGroup.rotation.y = gazeY + (this.isSpeaking ? speechTurn : 0);
      this.headGroup.rotation.x = gazeX + (this.isSpeaking ? (speechNod + headLean) : breathingNod) + ackNod;
      this.headGroup.rotation.z = (this.isSpeaking ? speechTilt : listeningTilt);
    }

    // 5. Aura serena pulsante de fundo
    if (this.auraMesh) {
      const auraPulse = this.isSpeaking
        ? Math.sin(time * 5.5) * 0.06 + 0.15
        : Math.sin(time * 1.6) * 0.02 + 0.07;
      this.auraMesh.material.opacity = auraPulse;
      this.auraMesh.rotation.z += 0.0015;
    }

    // 6. Piscar natural das pálpebras
    this.blinkTimer += delta;
    if (this.blinkTimer > this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkTimer = 0;
      this.blinkProgress = 0;
      this.nextBlinkInterval = 3.0 + Math.random() * 2.8;
    }

    let currentBlink = 0;
    if (this.isBlinking) {
      this.blinkProgress += delta * 8.5; // Duração rápida ~ 120ms
      if (this.blinkProgress >= Math.PI) {
        this.isBlinking = false;
        currentBlink = 0;
      } else {
        currentBlink = Math.sin(this.blinkProgress);
      }
    }

    // 7. Interpolação suave e orgânica do Lip-Sync
    this.lipSyncValue += (this.targetLipSync - this.lipSyncValue) * 0.35;

    // 8. Articulação Tridimensional de Vértices Faciais (Boca, Maxilar, Barba, Sobrancelhas e Olhos)
    if (this.avatarMesh && this.basePositions) {
      const posAttr = this.avatarMesh.geometry.attributes.position;
      let needsUpdate = false;

      const mouthOpen = this.lipSyncValue * 0.16;

      // A) Sincronização Labial tridimensional (abertura, projeção e largura fonética)
      if (this.mouthVertices.length > 0) {
        for (const item of this.mouthVertices) {
          if (item.isLowerLip) {
            // Lábio inferior desce, avança em Z e abre ligeiramente nas comissuras laterais
            const newY = item.baseY - (mouthOpen * 0.95 * item.weight);
            const newZ = item.baseZ + (mouthOpen * 0.12 * item.weight);
            const newX = item.baseX * (1.0 + mouthOpen * 0.22 * item.weight);
            posAttr.setX(item.index, newX);
            posAttr.setY(item.index, newY);
            posAttr.setZ(item.index, newZ);
          } else {
            // Lábio superior eleva-se suavemente
            const newY = item.baseY + (mouthOpen * 0.22 * item.weight);
            posAttr.setY(item.index, newY);
          }
        }
        needsUpdate = true;
      }

      // B) Maxilar e Barba acompanham o movimento da fala
      if (this.chinVertices.length > 0) {
        const chinDrop = mouthOpen * 0.52;
        for (const item of this.chinVertices) {
          const newY = item.baseY - (chinDrop * item.weight);
          const newZ = item.baseZ + (chinDrop * 0.25 * item.weight);
          posAttr.setY(item.index, newY);
          posAttr.setZ(item.index, newZ);
        }
        needsUpdate = true;
      }

      // C) Sobrancelhas expressivas (elevação nas ênfases de fala)
      if (this.browVertices.length > 0) {
        const browRaise = (Math.sin(time * 3.0) * 0.014 + 0.012) * this.lipSyncValue;
        for (const item of this.browVertices) {
          const newY = item.baseY + browRaise * item.weight;
          posAttr.setY(item.index, newY);
        }
        needsUpdate = true;
      }

      // D) Pálpebras e sorriso caloroso nos olhos (Duchenne smile)
      if (this.eyeVertices.length > 0) {
        const eyeOffset = currentBlink * 0.045;
        const smileSquinch = this.lipSyncValue * 0.007; // Olhos estreitam suavemente ao falar com calor humano
        for (const item of this.eyeVertices) {
          const newY = item.baseY - (eyeOffset + smileSquinch) * item.weight;
          posAttr.setY(item.index, newY);
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        posAttr.needsUpdate = true;
      }
    }

    // 7. Dança suave de partículas douradas (bokeh)
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += Math.sin(time * 0.8 + positions[i - 1]) * 0.0016;
        if (positions[i] > 3.2) positions[i] = -3.2;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.rotation.y = time * 0.015;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
