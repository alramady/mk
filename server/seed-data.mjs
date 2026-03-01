import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const pool = mysql.createPool(process.env.DATABASE_URL);

// S3 CDN image URLs (permanent, reliable)
const CDN = {
  apt1: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
  apt2: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
  apt3: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
  villa1: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
  villa2: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
  villa3: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
  studio1: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
  studio2: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
};

// S3 CDN photo pools by property type (permanent, reliable URLs)
const U = {
  apt: [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",  // luxury apartment living room
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",  // sea view apartment
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // master bedroom
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",  // modern kitchen
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800",  // furnished room
  ],
  villa: [
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",  // villa exterior with pool
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",  // compound/villa community
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // bedroom
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",  // kitchen
  ],
  studio: [
    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",  // studio interior
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800",  // furnished room
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",  // kitchen
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // bedroom
  ],
  duplex: [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",  // duplex staircase interior
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",  // living room
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // bedroom
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",  // kitchen
  ],
  room: [
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800",  // furnished room
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // bedroom
    "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",  // studio
  ],
  compound: [
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",  // compound aerial
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",  // villa
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",  // living room
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // bedroom
  ],
  hotel: [
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",  // hotel apartment suite
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800",  // furnished room
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",  // bedroom
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",  // kitchen
  ],
};

async function seed() {
  console.log("🌱 Starting seed...");

  // Create sample landlord users
  const landlords = [
    {
      openId: "local_landlord1",
      userId: "landlord1",
      passwordHash: await bcrypt.hash("landlord123", 10),
      displayName: "أحمد العتيبي",
      name: "Ahmed Al-Otaibi",
      nameAr: "أحمد العتيبي",
      email: "ahmed@example.com",
      phone: "+966501234567",
      role: "landlord",
      loginMethod: "local",
    },
    {
      openId: "local_landlord2",
      userId: "landlord2",
      passwordHash: await bcrypt.hash("landlord123", 10),
      displayName: "محمد القحطاني",
      name: "Mohammed Al-Qahtani",
      nameAr: "محمد القحطاني",
      email: "mohammed@example.com",
      phone: "+966502345678",
      role: "landlord",
      loginMethod: "local",
    },
    {
      openId: "local_landlord3",
      userId: "landlord3",
      passwordHash: await bcrypt.hash("landlord123", 10),
      displayName: "عبدالله الشهري",
      name: "Abdullah Al-Shahri",
      nameAr: "عبدالله الشهري",
      email: "abdullah@example.com",
      phone: "+966503456789",
      role: "landlord",
      loginMethod: "local",
    },
  ];

  // Create sample tenant users
  const tenants = [
    {
      openId: "local_tenant1",
      userId: "tenant1",
      passwordHash: await bcrypt.hash("tenant123", 10),
      displayName: "سارة الدوسري",
      name: "Sara Al-Dosari",
      nameAr: "سارة الدوسري",
      email: "sara@example.com",
      phone: "+966504567890",
      role: "tenant",
      loginMethod: "local",
    },
    {
      openId: "local_tenant2",
      userId: "tenant2",
      passwordHash: await bcrypt.hash("tenant123", 10),
      displayName: "فهد المطيري",
      name: "Fahad Al-Mutairi",
      nameAr: "فهد المطيري",
      email: "fahad@example.com",
      phone: "+966505678901",
      role: "tenant",
      loginMethod: "local",
    },
  ];

  // Insert users
  const allUsers = [...landlords, ...tenants];
  for (const user of allUsers) {
    try {
      await pool.execute(
        `INSERT IGNORE INTO users (openId, userId, passwordHash, displayName, name, nameAr, email, phone, role, loginMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.openId, user.userId, user.passwordHash, user.displayName, user.name, user.nameAr, user.email, user.phone, user.role, user.loginMethod]
      );
      console.log(`✅ User: ${user.displayName}`);
    } catch (e) {
      console.log(`⚠️ User exists: ${user.displayName}`);
    }
  }

  // Get landlord IDs
  const [landlordRows] = await pool.execute(`SELECT id, userId FROM users WHERE role = 'landlord'`);
  const landlordIds = {};
  for (const row of landlordRows) {
    landlordIds[row.userId] = row.id;
  }

  const l1 = landlordIds["landlord1"] || 2;
  const l2 = landlordIds["landlord2"] || 3;
  const l3 = landlordIds["landlord3"] || 4;

  // Properties data
  const propertiesData = [
    // ─── Riyadh ─────────────────────────────────────────
    {
      landlordId: l1,
      titleEn: "Luxury Furnished Apartment in Al Nakheel",
      titleAr: "شقة فاخرة مفروشة في النخيل",
      descriptionEn: "Modern 3-bedroom apartment with premium furnishing, located in the prestigious Al Nakheel district. Features include marble flooring, smart home system, and a stunning city view.",
      descriptionAr: "شقة حديثة من 3 غرف نوم بتأثيث فاخر، تقع في حي النخيل الراقي. تتميز بأرضيات رخامية ونظام منزل ذكي وإطلالة خلابة على المدينة.",
      propertyType: "apartment",
      status: "active",
      city: "Riyadh", cityAr: "الرياض",
      district: "Al Nakheel", districtAr: "النخيل",
      address: "King Fahd Road, Al Nakheel, Riyadh",
      addressAr: "طريق الملك فهد، النخيل، الرياض",
      latitude: "24.7136", longitude: "46.6753",
      bedrooms: 3, bathrooms: 2, sizeSqm: 180, floor: 8, totalFloors: 15, yearBuilt: 2022,
      furnishedLevel: "fully_furnished",
      monthlyRent: "8500.00", securityDeposit: "8500.00",
      amenities: JSON.stringify(["wifi", "parking", "gym", "pool", "security", "elevator", "ac", "balcony"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking, no pets, quiet hours after 10 PM",
      houseRulesAr: "ممنوع التدخين، ممنوع الحيوانات الأليفة، ساعات الهدوء بعد 10 مساءً",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.apt1, CDN.apt2, CDN.apt3, U.apt[3], U.apt[4], U.apt[5], U.apt[7]]),
      isFeatured: true, isVerified: true,
    },
    {
      landlordId: l1,
      titleEn: "Modern Villa in Al Malqa",
      titleAr: "فيلا عصرية في الملقا",
      descriptionEn: "Spacious 5-bedroom villa with private garden and pool. Modern architecture with high-end finishes. Perfect for families seeking luxury living in North Riyadh.",
      descriptionAr: "فيلا واسعة من 5 غرف نوم مع حديقة خاصة ومسبح. تصميم عصري بتشطيبات فاخرة. مثالية للعائلات الباحثة عن السكن الفاخر في شمال الرياض.",
      propertyType: "villa",
      status: "active",
      city: "Riyadh", cityAr: "الرياض",
      district: "Al Malqa", districtAr: "الملقا",
      address: "Prince Mohammed Bin Salman Road, Al Malqa",
      addressAr: "طريق الأمير محمد بن سلمان، الملقا",
      latitude: "24.8200", longitude: "46.6250",
      bedrooms: 5, bathrooms: 4, sizeSqm: 450, floor: 1, totalFloors: 2, yearBuilt: 2023,
      furnishedLevel: "fully_furnished",
      monthlyRent: "25000.00", securityDeposit: "25000.00",
      amenities: JSON.stringify(["wifi", "parking", "pool", "garden", "security", "ac", "maid_room", "driver_room"]),
      utilitiesIncluded: JSON.stringify(["water"]),
      houseRules: "Family only, no parties",
      houseRulesAr: "عائلات فقط، ممنوع الحفلات",
      minStayMonths: 3, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([CDN.villa2, CDN.villa3, CDN.villa1, U.villa[3], U.villa[4], U.villa[5], U.villa[7]]),
      isFeatured: true, isVerified: true,
    },
    {
      landlordId: l2,
      titleEn: "Cozy Studio in Al Olaya",
      titleAr: "استوديو مريح في العليا",
      descriptionEn: "Fully furnished studio in the heart of Al Olaya business district. Walking distance to malls, restaurants, and metro station. Ideal for professionals.",
      descriptionAr: "استوديو مفروش بالكامل في قلب حي العليا التجاري. على مسافة قريبة من المولات والمطاعم ومحطة المترو. مثالي للمهنيين.",
      propertyType: "studio",
      status: "active",
      city: "Riyadh", cityAr: "الرياض",
      district: "Al Olaya", districtAr: "العليا",
      address: "Olaya Street, Al Olaya, Riyadh",
      addressAr: "شارع العليا، حي العليا، الرياض",
      latitude: "24.6900", longitude: "46.6850",
      bedrooms: 0, bathrooms: 1, sizeSqm: 45, floor: 12, totalFloors: 20, yearBuilt: 2021,
      furnishedLevel: "fully_furnished",
      monthlyRent: "3500.00", securityDeposit: "3500.00",
      amenities: JSON.stringify(["wifi", "parking", "gym", "security", "elevator", "ac", "laundry"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking inside, no loud music",
      houseRulesAr: "ممنوع التدخين داخل الوحدة، ممنوع الموسيقى الصاخبة",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.studio1, CDN.studio2, U.studio[2], U.studio[3], U.studio[4], U.studio[6]]),
      isFeatured: false, isVerified: true,
    },
    {
      landlordId: l2,
      titleEn: "Family Apartment in Al Yasmin",
      titleAr: "شقة عائلية في الياسمين",
      descriptionEn: "Spacious 4-bedroom apartment in the family-friendly Al Yasmin district. Close to schools, parks, and shopping centers.",
      descriptionAr: "شقة واسعة من 4 غرف نوم في حي الياسمين المناسب للعائلات. قريبة من المدارس والحدائق ومراكز التسوق.",
      propertyType: "apartment",
      status: "active",
      city: "Riyadh", cityAr: "الرياض",
      district: "Al Yasmin", districtAr: "الياسمين",
      address: "Al Yasmin, Riyadh",
      addressAr: "حي الياسمين، الرياض",
      latitude: "24.8100", longitude: "46.6400",
      bedrooms: 4, bathrooms: 3, sizeSqm: 220, floor: 3, totalFloors: 6, yearBuilt: 2020,
      furnishedLevel: "semi_furnished",
      monthlyRent: "7000.00", securityDeposit: "7000.00",
      amenities: JSON.stringify(["parking", "security", "elevator", "ac", "playground", "garden"]),
      utilitiesIncluded: JSON.stringify([]),
      houseRules: "Families only",
      houseRulesAr: "عائلات فقط",
      minStayMonths: 6, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([CDN.apt2, CDN.apt3, CDN.apt1, U.apt[0], U.apt[4], U.apt[9]]),
      isFeatured: false, isVerified: true,
    },

    // ─── Jeddah ─────────────────────────────────────────
    {
      landlordId: l1,
      titleEn: "Sea View Apartment in Al Corniche",
      titleAr: "شقة بإطلالة بحرية على الكورنيش",
      descriptionEn: "Stunning 2-bedroom apartment with panoramic Red Sea views. Located on Jeddah's famous Corniche with direct beach access.",
      descriptionAr: "شقة رائعة من غرفتي نوم بإطلالة بانورامية على البحر الأحمر. تقع على كورنيش جدة الشهير مع وصول مباشر للشاطئ.",
      propertyType: "apartment",
      status: "active",
      city: "Jeddah", cityAr: "جدة",
      district: "Al Corniche", districtAr: "الكورنيش",
      address: "Corniche Road, Jeddah",
      addressAr: "طريق الكورنيش، جدة",
      latitude: "21.5433", longitude: "39.1728",
      bedrooms: 2, bathrooms: 2, sizeSqm: 140, floor: 15, totalFloors: 25, yearBuilt: 2023,
      furnishedLevel: "fully_furnished",
      monthlyRent: "9000.00", securityDeposit: "9000.00",
      amenities: JSON.stringify(["wifi", "parking", "gym", "pool", "security", "elevator", "ac", "sea_view", "balcony"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking, respect quiet hours",
      houseRulesAr: "ممنوع التدخين، احترام ساعات الهدوء",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.apt1, CDN.apt3, U.apt[2], U.apt[5], U.apt[7], U.apt[8]]),
      isFeatured: true, isVerified: true,
    },
    {
      landlordId: l3,
      titleEn: "Hotel Apartment in Al Hamra",
      titleAr: "شقة فندقية في الحمراء",
      descriptionEn: "Premium hotel apartment with daily housekeeping, concierge service, and all amenities. Perfect for business travelers and extended stays.",
      descriptionAr: "شقة فندقية فاخرة مع خدمة تنظيف يومية وخدمة استقبال وجميع المرافق. مثالية لرجال الأعمال والإقامات الطويلة.",
      propertyType: "hotel_apartment",
      status: "active",
      city: "Jeddah", cityAr: "جدة",
      district: "Al Hamra", districtAr: "الحمراء",
      address: "Palestine Street, Al Hamra, Jeddah",
      addressAr: "شارع فلسطين، الحمراء، جدة",
      latitude: "21.5200", longitude: "39.1800",
      bedrooms: 1, bathrooms: 1, sizeSqm: 65, floor: 5, totalFloors: 10, yearBuilt: 2021,
      furnishedLevel: "fully_furnished",
      monthlyRent: "6000.00", securityDeposit: "3000.00",
      amenities: JSON.stringify(["wifi", "parking", "gym", "pool", "security", "elevator", "ac", "room_service", "laundry", "concierge"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet", "gas"]),
      houseRules: "Hotel rules apply",
      houseRulesAr: "تطبق قوانين الفندق",
      minStayMonths: 1, maxStayMonths: 6, instantBook: true,
      photos: JSON.stringify([U.hotel[0], U.hotel[1], U.hotel[2], U.hotel[3], U.hotel[4], U.hotel[6]]),
      isFeatured: false, isVerified: true,
    },
    {
      landlordId: l2,
      titleEn: "Furnished Studio in Al Rawdah",
      titleAr: "استوديو مفروش في الروضة",
      descriptionEn: "Compact and modern studio apartment in Al Rawdah. Fully equipped kitchen, smart TV, and high-speed internet. Near King Abdulaziz International Airport.",
      descriptionAr: "استوديو حديث ومدمج في حي الروضة. مطبخ مجهز بالكامل وتلفزيون ذكي وإنترنت عالي السرعة. قريب من مطار الملك عبدالعزيز الدولي.",
      propertyType: "studio",
      status: "active",
      city: "Jeddah", cityAr: "جدة",
      district: "Al Rawdah", districtAr: "الروضة",
      address: "Al Rawdah, Jeddah",
      addressAr: "حي الروضة، جدة",
      latitude: "21.5700", longitude: "39.1500",
      bedrooms: 0, bathrooms: 1, sizeSqm: 40, floor: 3, totalFloors: 8, yearBuilt: 2022,
      furnishedLevel: "fully_furnished",
      monthlyRent: "2800.00", securityDeposit: "2800.00",
      amenities: JSON.stringify(["wifi", "parking", "security", "elevator", "ac"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking, no pets",
      houseRulesAr: "ممنوع التدخين، ممنوع الحيوانات",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.studio2, CDN.studio1, U.studio[2], U.studio[3], U.studio[4]]),
      isFeatured: false, isVerified: true,
    },

    // ─── Dammam ─────────────────────────────────────────
    {
      landlordId: l3,
      titleEn: "Modern Duplex in Al Faisaliyah",
      titleAr: "دوبلكس عصري في الفيصلية",
      descriptionEn: "Beautiful 4-bedroom duplex with modern design. Two floors with private entrance, garden, and covered parking. Located in the upscale Al Faisaliyah district.",
      descriptionAr: "دوبلكس جميل من 4 غرف نوم بتصميم عصري. طابقين مع مدخل خاص وحديقة وموقف مغطى. يقع في حي الفيصلية الراقي.",
      propertyType: "duplex",
      status: "active",
      city: "Dammam", cityAr: "الدمام",
      district: "Al Faisaliyah", districtAr: "الفيصلية",
      address: "Al Faisaliyah, Dammam",
      addressAr: "حي الفيصلية، الدمام",
      latitude: "26.4207", longitude: "50.0888",
      bedrooms: 4, bathrooms: 3, sizeSqm: 280, floor: 1, totalFloors: 2, yearBuilt: 2021,
      furnishedLevel: "semi_furnished",
      monthlyRent: "9500.00", securityDeposit: "9500.00",
      amenities: JSON.stringify(["parking", "garden", "security", "ac", "maid_room"]),
      utilitiesIncluded: JSON.stringify([]),
      houseRules: "Families only, no modifications to structure",
      houseRulesAr: "عائلات فقط، ممنوع التعديل على الهيكل",
      minStayMonths: 6, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([U.duplex[0], U.duplex[1], U.duplex[2], U.duplex[3], U.duplex[4], U.duplex[5], U.duplex[6]]),
      isFeatured: true, isVerified: true,
    },
    {
      landlordId: l1,
      titleEn: "Affordable Apartment in Al Murjan",
      titleAr: "شقة اقتصادية في المرجان",
      descriptionEn: "Clean and well-maintained 2-bedroom apartment. Great value for money with essential amenities. Close to Dammam Corniche.",
      descriptionAr: "شقة نظيفة ومُعتنى بها من غرفتي نوم. قيمة ممتازة مقابل السعر مع المرافق الأساسية. قريبة من كورنيش الدمام.",
      propertyType: "apartment",
      status: "active",
      city: "Dammam", cityAr: "الدمام",
      district: "Al Murjan", districtAr: "المرجان",
      address: "Al Murjan, Dammam",
      addressAr: "حي المرجان، الدمام",
      latitude: "26.4300", longitude: "50.1100",
      bedrooms: 2, bathrooms: 1, sizeSqm: 100, floor: 2, totalFloors: 4, yearBuilt: 2018,
      furnishedLevel: "unfurnished",
      monthlyRent: "3000.00", securityDeposit: "3000.00",
      amenities: JSON.stringify(["parking", "ac", "elevator"]),
      utilitiesIncluded: JSON.stringify([]),
      houseRules: "No pets",
      houseRulesAr: "ممنوع الحيوانات الأليفة",
      minStayMonths: 3, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.apt2, CDN.apt1, U.apt[3], U.apt[6], U.apt[8]]),
      isFeatured: false, isVerified: true,
    },

    // ─── Khobar ─────────────────────────────────────────
    {
      landlordId: l2,
      titleEn: "Compound Villa in Al Khobar",
      titleAr: "فيلا كمباوند في الخبر",
      descriptionEn: "Luxurious compound villa with shared pool, gym, and playground. 4 bedrooms with maid's room. Gated community with 24/7 security.",
      descriptionAr: "فيلا كمباوند فاخرة مع مسبح مشترك وصالة رياضية وملعب أطفال. 4 غرف نوم مع غرفة خادمة. مجتمع مسور بحراسة على مدار الساعة.",
      propertyType: "compound",
      status: "active",
      city: "Khobar", cityAr: "الخبر",
      district: "Al Aqrabiyah", districtAr: "العقربية",
      address: "Al Aqrabiyah, Khobar",
      addressAr: "حي العقربية، الخبر",
      latitude: "26.2800", longitude: "50.2100",
      bedrooms: 4, bathrooms: 3, sizeSqm: 350, floor: 1, totalFloors: 2, yearBuilt: 2020,
      furnishedLevel: "semi_furnished",
      monthlyRent: "15000.00", securityDeposit: "15000.00",
      amenities: JSON.stringify(["parking", "pool", "gym", "playground", "garden", "security", "ac", "maid_room"]),
      utilitiesIncluded: JSON.stringify(["water"]),
      houseRules: "Compound rules apply, families only",
      houseRulesAr: "تطبق قوانين الكمباوند، عائلات فقط",
      minStayMonths: 6, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([U.compound[0], U.compound[1], U.compound[2], U.compound[3], U.compound[4], U.compound[5], U.compound[6]]),
      isFeatured: true, isVerified: true,
    },

    // ─── Makkah ─────────────────────────────────────────
    {
      landlordId: l3,
      titleEn: "Furnished Room near Al Haram",
      titleAr: "غرفة مفروشة قرب الحرم",
      descriptionEn: "Comfortable furnished room just 500 meters from Al Masjid Al Haram. Perfect for Umrah visitors and long-term stays. Includes breakfast.",
      descriptionAr: "غرفة مفروشة مريحة على بعد 500 متر من المسجد الحرام. مثالية لزوار العمرة والإقامات الطويلة. يشمل الإفطار.",
      propertyType: "furnished_room",
      status: "active",
      city: "Makkah", cityAr: "مكة المكرمة",
      district: "Al Aziziyah", districtAr: "العزيزية",
      address: "Al Aziziyah, Makkah",
      addressAr: "حي العزيزية، مكة المكرمة",
      latitude: "21.4225", longitude: "39.8262",
      bedrooms: 1, bathrooms: 1, sizeSqm: 30, floor: 4, totalFloors: 8, yearBuilt: 2019,
      furnishedLevel: "fully_furnished",
      monthlyRent: "4000.00", securityDeposit: "2000.00",
      amenities: JSON.stringify(["wifi", "ac", "elevator", "security", "laundry"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "Respect Islamic values, quiet hours after Isha prayer",
      houseRulesAr: "احترام القيم الإسلامية، ساعات الهدوء بعد صلاة العشاء",
      minStayMonths: 1, maxStayMonths: 6, instantBook: true,
      photos: JSON.stringify([U.room[0], U.room[1], U.room[2], U.room[3], U.room[4], U.room[5]]),
      isFeatured: true, isVerified: true,
    },

    // ─── Madinah ────────────────────────────────────────
    {
      landlordId: l1,
      titleEn: "Apartment near Prophet's Mosque",
      titleAr: "شقة قرب المسجد النبوي",
      descriptionEn: "2-bedroom apartment within walking distance of the Prophet's Mosque. Fully furnished with modern amenities. Ideal for families visiting Madinah.",
      descriptionAr: "شقة من غرفتي نوم على مسافة مشي من المسجد النبوي. مفروشة بالكامل بمرافق حديثة. مثالية للعائلات الزائرة للمدينة المنورة.",
      propertyType: "apartment",
      status: "active",
      city: "Madinah", cityAr: "المدينة المنورة",
      district: "Al Haram", districtAr: "الحرم",
      address: "Near Prophet's Mosque, Madinah",
      addressAr: "قرب المسجد النبوي، المدينة المنورة",
      latitude: "24.4672", longitude: "39.6112",
      bedrooms: 2, bathrooms: 1, sizeSqm: 90, floor: 6, totalFloors: 10, yearBuilt: 2020,
      furnishedLevel: "fully_furnished",
      monthlyRent: "5500.00", securityDeposit: "5500.00",
      amenities: JSON.stringify(["wifi", "ac", "elevator", "security", "parking"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "Family-friendly, no smoking",
      houseRulesAr: "مناسب للعائلات، ممنوع التدخين",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.apt3, CDN.apt1, CDN.apt2, U.apt[0], U.apt[3], U.apt[9]]),
      isFeatured: false, isVerified: true,
    },

    // ─── Tabuk ──────────────────────────────────────────
    {
      landlordId: l2,
      titleEn: "Modern Apartment in Tabuk City Center",
      titleAr: "شقة حديثة في وسط مدينة تبوك",
      descriptionEn: "Brand new 3-bedroom apartment in Tabuk city center. Modern design with quality finishes. Close to all services and NEOM project area.",
      descriptionAr: "شقة جديدة من 3 غرف نوم في وسط مدينة تبوك. تصميم حديث بتشطيبات عالية الجودة. قريبة من جميع الخدمات ومنطقة مشروع نيوم.",
      propertyType: "apartment",
      status: "active",
      city: "Tabuk", cityAr: "تبوك",
      district: "City Center", districtAr: "وسط المدينة",
      address: "King Khalid Road, Tabuk",
      addressAr: "طريق الملك خالد، تبوك",
      latitude: "28.3838", longitude: "36.5550",
      bedrooms: 3, bathrooms: 2, sizeSqm: 150, floor: 4, totalFloors: 6, yearBuilt: 2024,
      furnishedLevel: "unfurnished",
      monthlyRent: "4500.00", securityDeposit: "4500.00",
      amenities: JSON.stringify(["parking", "ac", "elevator", "security"]),
      utilitiesIncluded: JSON.stringify([]),
      houseRules: "Standard residential rules",
      houseRulesAr: "قوانين سكنية عادية",
      minStayMonths: 3, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([CDN.apt1, CDN.apt2, CDN.apt3, U.apt[2], U.apt[5], U.apt[7]]),
      isFeatured: false, isVerified: true,
    },

    // ─── Abha ───────────────────────────────────────────
    {
      landlordId: l3,
      titleEn: "Mountain View Villa in Abha",
      titleAr: "فيلا بإطلالة جبلية في أبها",
      descriptionEn: "Charming 3-bedroom villa with breathtaking mountain views. Cool climate year-round. Features a fireplace, garden, and traditional Saudi architecture elements.",
      descriptionAr: "فيلا ساحرة من 3 غرف نوم بإطلالة خلابة على الجبال. مناخ بارد طوال العام. تتميز بمدفأة وحديقة وعناصر من العمارة السعودية التقليدية.",
      propertyType: "villa",
      status: "active",
      city: "Abha", cityAr: "أبها",
      district: "Al Manhal", districtAr: "المنهل",
      address: "Al Manhal, Abha",
      addressAr: "حي المنهل، أبها",
      latitude: "18.2164", longitude: "42.5053",
      bedrooms: 3, bathrooms: 2, sizeSqm: 250, floor: 1, totalFloors: 2, yearBuilt: 2019,
      furnishedLevel: "fully_furnished",
      monthlyRent: "7000.00", securityDeposit: "7000.00",
      amenities: JSON.stringify(["parking", "garden", "fireplace", "ac", "mountain_view", "bbq"]),
      utilitiesIncluded: JSON.stringify(["water"]),
      houseRules: "No parties, respect neighbors",
      houseRulesAr: "ممنوع الحفلات، احترام الجيران",
      minStayMonths: 1, maxStayMonths: 6, instantBook: true,
      photos: JSON.stringify([CDN.villa1, CDN.villa2, CDN.villa3, U.villa[0], U.villa[4], U.villa[7], U.villa[8]]),
      isFeatured: true, isVerified: true,
    },

    // ─── More Riyadh ────────────────────────────────────
    {
      landlordId: l3,
      titleEn: "Budget Furnished Room in Al Batha",
      titleAr: "غرفة مفروشة اقتصادية في البطحاء",
      descriptionEn: "Affordable furnished room in central Al Batha. Basic amenities included. Perfect for singles and workers on a budget.",
      descriptionAr: "غرفة مفروشة بسعر مناسب في البطحاء المركزية. المرافق الأساسية متوفرة. مثالية للعزاب والعمال بميزانية محدودة.",
      propertyType: "furnished_room",
      status: "active",
      city: "Riyadh", cityAr: "الرياض",
      district: "Al Batha", districtAr: "البطحاء",
      address: "Al Batha, Riyadh",
      addressAr: "حي البطحاء، الرياض",
      latitude: "24.6300", longitude: "46.7100",
      bedrooms: 1, bathrooms: 1, sizeSqm: 25, floor: 2, totalFloors: 4, yearBuilt: 2015,
      furnishedLevel: "fully_furnished",
      monthlyRent: "1500.00", securityDeposit: "1500.00",
      amenities: JSON.stringify(["wifi", "ac", "shared_kitchen"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking, shared facilities rules apply",
      houseRulesAr: "ممنوع التدخين، تطبق قوانين المرافق المشتركة",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.studio2, CDN.studio1, U.room[0], U.room[1], U.room[3], U.room[4]]),
      isFeatured: false, isVerified: true,
    },
    {
      landlordId: l1,
      titleEn: "Executive Apartment in KAFD",
      titleAr: "شقة تنفيذية في كافد",
      descriptionEn: "Premium 2-bedroom apartment in King Abdullah Financial District. Smart home technology, premium finishes, and stunning skyline views. Walking distance to KAFD metro station.",
      descriptionAr: "شقة فاخرة من غرفتي نوم في مركز الملك عبدالله المالي. تقنية المنزل الذكي وتشطيبات فاخرة وإطلالات خلابة على أفق المدينة. على مسافة مشي من محطة مترو كافد.",
      propertyType: "apartment",
      status: "active",
      city: "Riyadh", cityAr: "الرياض",
      district: "KAFD", districtAr: "كافد",
      address: "King Abdullah Financial District, Riyadh",
      addressAr: "مركز الملك عبدالله المالي، الرياض",
      latitude: "24.7700", longitude: "46.6400",
      bedrooms: 2, bathrooms: 2, sizeSqm: 130, floor: 20, totalFloors: 35, yearBuilt: 2024,
      furnishedLevel: "fully_furnished",
      monthlyRent: "12000.00", securityDeposit: "12000.00",
      amenities: JSON.stringify(["wifi", "parking", "gym", "pool", "security", "elevator", "ac", "smart_home", "concierge", "balcony"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "Professional conduct, no pets",
      houseRulesAr: "سلوك مهني، ممنوع الحيوانات الأليفة",
      minStayMonths: 1, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([CDN.apt1, CDN.apt3, CDN.apt2, U.apt[1], U.apt[4], U.apt[6], U.apt[8]]),
      isFeatured: true, isVerified: true,
    },

    // ─── More Jeddah ────────────────────────────────────
    {
      landlordId: l3,
      titleEn: "Family Villa in Al Zahra",
      titleAr: "فيلا عائلية في الزهراء",
      descriptionEn: "Spacious 6-bedroom villa in the prestigious Al Zahra district. Features include a large garden, private pool, and driver/maid quarters.",
      descriptionAr: "فيلا واسعة من 6 غرف نوم في حي الزهراء الراقي. تتميز بحديقة كبيرة ومسبح خاص وغرف سائق وخادمة.",
      propertyType: "villa",
      status: "active",
      city: "Jeddah", cityAr: "جدة",
      district: "Al Zahra", districtAr: "الزهراء",
      address: "Al Zahra, Jeddah",
      addressAr: "حي الزهراء، جدة",
      latitude: "21.5500", longitude: "39.1600",
      bedrooms: 6, bathrooms: 5, sizeSqm: 500, floor: 1, totalFloors: 2, yearBuilt: 2021,
      furnishedLevel: "semi_furnished",
      monthlyRent: "22000.00", securityDeposit: "22000.00",
      amenities: JSON.stringify(["parking", "pool", "garden", "security", "ac", "maid_room", "driver_room", "bbq"]),
      utilitiesIncluded: JSON.stringify([]),
      houseRules: "Families only, no structural modifications",
      houseRulesAr: "عائلات فقط، ممنوع التعديلات الإنشائية",
      minStayMonths: 6, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([CDN.villa2, CDN.villa1, CDN.villa3, U.villa[1], U.villa[3], U.villa[5], U.villa[6]]),
      isFeatured: false, isVerified: true,
    },

    // ─── More Dammam / Khobar ───────────────────────────
    {
      landlordId: l2,
      titleEn: "Waterfront Apartment in Half Moon Bay",
      titleAr: "شقة على الواجهة البحرية في نصف القمر",
      descriptionEn: "Exclusive 3-bedroom apartment overlooking Half Moon Bay. Resort-style living with beach access, water sports, and fine dining nearby.",
      descriptionAr: "شقة حصرية من 3 غرف نوم تطل على خليج نصف القمر. حياة منتجعية مع وصول للشاطئ ورياضات مائية ومطاعم فاخرة قريبة.",
      propertyType: "apartment",
      status: "active",
      city: "Khobar", cityAr: "الخبر",
      district: "Half Moon Bay", districtAr: "نصف القمر",
      address: "Half Moon Bay, Khobar",
      addressAr: "خليج نصف القمر، الخبر",
      latitude: "26.2500", longitude: "50.2500",
      bedrooms: 3, bathrooms: 2, sizeSqm: 170, floor: 10, totalFloors: 18, yearBuilt: 2023,
      furnishedLevel: "fully_furnished",
      monthlyRent: "11000.00", securityDeposit: "11000.00",
      amenities: JSON.stringify(["wifi", "parking", "gym", "pool", "security", "elevator", "ac", "sea_view", "balcony", "beach_access"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking, no parties",
      houseRulesAr: "ممنوع التدخين، ممنوع الحفلات",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.apt3, CDN.apt1, CDN.apt2, U.apt[0], U.apt[3], U.apt[5], U.apt[7], U.apt[9]]),
      isFeatured: true, isVerified: true,
    },

    // ─── Pending properties for admin review ────────────
    {
      landlordId: l1,
      titleEn: "New Listing - Studio in Al Sulaimaniyah",
      titleAr: "إدراج جديد - استوديو في السليمانية",
      descriptionEn: "Newly listed studio apartment awaiting admin approval. Located in Al Sulaimaniyah, Riyadh.",
      descriptionAr: "استوديو جديد في انتظار موافقة الإدارة. يقع في حي السليمانية، الرياض.",
      propertyType: "studio",
      status: "pending",
      city: "Riyadh", cityAr: "الرياض",
      district: "Al Sulaimaniyah", districtAr: "السليمانية",
      address: "Al Sulaimaniyah, Riyadh",
      addressAr: "حي السليمانية، الرياض",
      latitude: "24.6800", longitude: "46.6900",
      bedrooms: 0, bathrooms: 1, sizeSqm: 35, floor: 5, totalFloors: 8, yearBuilt: 2023,
      furnishedLevel: "fully_furnished",
      monthlyRent: "3200.00", securityDeposit: "3200.00",
      amenities: JSON.stringify(["wifi", "ac", "elevator", "parking"]),
      utilitiesIncluded: JSON.stringify(["electricity", "water", "internet"]),
      houseRules: "No smoking",
      houseRulesAr: "ممنوع التدخين",
      minStayMonths: 1, maxStayMonths: 12, instantBook: true,
      photos: JSON.stringify([CDN.studio1, CDN.studio2, U.studio[0], U.studio[3], U.studio[4]]),
      isFeatured: false, isVerified: false,
    },
    {
      landlordId: l2,
      titleEn: "Pending Review - Apartment in Al Hamra Jeddah",
      titleAr: "قيد المراجعة - شقة في الحمراء جدة",
      descriptionEn: "3-bedroom apartment pending review. Located in Al Hamra, Jeddah.",
      descriptionAr: "شقة من 3 غرف نوم قيد المراجعة. تقع في حي الحمراء، جدة.",
      propertyType: "apartment",
      status: "pending",
      city: "Jeddah", cityAr: "جدة",
      district: "Al Hamra", districtAr: "الحمراء",
      address: "Al Hamra, Jeddah",
      addressAr: "حي الحمراء، جدة",
      latitude: "21.5150", longitude: "39.1750",
      bedrooms: 3, bathrooms: 2, sizeSqm: 160, floor: 7, totalFloors: 12, yearBuilt: 2022,
      furnishedLevel: "semi_furnished",
      monthlyRent: "6500.00", securityDeposit: "6500.00",
      amenities: JSON.stringify(["parking", "ac", "elevator", "security"]),
      utilitiesIncluded: JSON.stringify([]),
      houseRules: "Standard rules",
      houseRulesAr: "قوانين عادية",
      minStayMonths: 3, maxStayMonths: 12, instantBook: false,
      photos: JSON.stringify([CDN.apt2, CDN.apt3, U.apt[1], U.apt[4], U.apt[6]]),
      isFeatured: false, isVerified: false,
    },
  ];

  // Insert properties
  for (const prop of propertiesData) {
    try {
      const cols = Object.keys(prop);
      const placeholders = cols.map(() => "?").join(", ");
      const values = cols.map(k => prop[k]);
      await pool.execute(
        `INSERT INTO properties (${cols.join(", ")}) VALUES (${placeholders})`,
        values
      );
      console.log(`✅ Property: ${prop.titleAr}`);
    } catch (e) {
      console.log(`⚠️ Property error: ${prop.titleAr} - ${e.message}`);
    }
  }

  // Seed knowledge base
  const kbArticles = [
    {
      category: "faq",
      titleEn: "How to search for a property?",
      titleAr: "كيف أبحث عن عقار؟",
      contentEn: "Go to the Search page from the navigation bar. Use filters to narrow down by city, price range, property type, number of bedrooms/bathrooms, and furnishing level.",
      contentAr: "اذهب لصفحة البحث من شريط التنقل. استخدم الفلاتر للتصفية حسب المدينة، نطاق السعر، نوع العقار، عدد الغرف/الحمامات، ومستوى التأثيث.",
      tags: JSON.stringify(["search", "filter", "بحث", "فلتر"]),
    },
    {
      category: "faq",
      titleEn: "How to book a property?",
      titleAr: "كيف أحجز عقار؟",
      contentEn: "Find a property, click Book Now, select dates and duration, review costs (rent + deposit + 5% service fee), and confirm.",
      contentAr: "ابحث عن عقار، اضغط احجز الآن، اختر التواريخ والمدة، راجع التكاليف (إيجار + تأمين + رسوم خدمة 5%)، وأكد الحجز.",
      tags: JSON.stringify(["booking", "حجز"]),
    },
    {
      category: "faq",
      titleEn: "How to submit a maintenance request?",
      titleAr: "كيف أرسل طلب صيانة؟",
      contentEn: "Go to Dashboard > Maintenance > New Request. Select property, category, priority, describe the issue, and attach photos.",
      contentAr: "اذهب للوحة التحكم > الصيانة > طلب جديد. اختر العقار والفئة والأولوية، اوصف المشكلة، وأرفق صور.",
      tags: JSON.stringify(["maintenance", "صيانة"]),
    },
    {
      category: "tenant_guide",
      titleEn: "Tenant Getting Started Guide",
      titleAr: "دليل المستأجر للبدء",
      contentEn: "Search properties, save favorites, book with 4-step process, communicate with landlords, submit maintenance requests, track payments.",
      contentAr: "ابحث عن عقارات، احفظ المفضلات، احجز بعملية من 4 خطوات، تواصل مع الملاك، أرسل طلبات صيانة، تابع المدفوعات.",
      tags: JSON.stringify(["tenant", "guide", "مستأجر"]),
    },
    {
      category: "landlord_guide",
      titleEn: "Landlord Property Listing Guide",
      titleAr: "دليل المالك لإدراج العقار",
      contentEn: "Click Add Property, fill details in Arabic and English, set pricing, upload photos, set amenities and rules, submit for review.",
      contentAr: "اضغط أضف عقارك، املأ التفاصيل بالعربي والإنجليزي، حدد الأسعار، ارفع الصور، حدد المرافق والقوانين، أرسل للمراجعة.",
      tags: JSON.stringify(["landlord", "listing", "مالك"]),
    },
    {
      category: "policy",
      titleEn: "Cancellation and Refund Policy",
      titleAr: "سياسة الإلغاء والاسترداد",
      contentEn: "Cancel before approval for free. After approval, subject to lease terms. Deposits refundable after inspection. Service fees non-refundable.",
      contentAr: "إلغاء مجاني قبل الموافقة. بعد الموافقة، يخضع لشروط العقد. التأمين قابل للاسترداد بعد الفحص. رسوم الخدمة غير قابلة للاسترداد.",
      tags: JSON.stringify(["cancellation", "refund", "إلغاء"]),
    },
  ];

  for (const article of kbArticles) {
    try {
      await pool.execute(
        `INSERT INTO knowledgeBase (category, titleEn, titleAr, contentEn, contentAr, tags) VALUES (?, ?, ?, ?, ?, ?)`,
        [article.category, article.titleEn, article.titleAr, article.contentEn, article.contentAr, article.tags]
      );
      console.log(`✅ KB: ${article.titleAr}`);
    } catch (e) {
      console.log(`⚠️ KB error: ${article.titleAr} - ${e.message}`);
    }
  }

  console.log("\n🎉 Seed complete!");
  await pool.end();
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
