import { KnowledgeItem } from '../types';

/**
 * เมนูอาหารรายจาน จากเล่มเมนูอาหารบ้านโฮม BH 2026
 * แยกเป็นรายการต่อจาน เพื่อให้ค้นหาชื่อเมนู/ราคาได้ตรงตัว (รายการสรุปกลุ่มอยู่ใน brochureKnowledgeItems.ts: REST-101..110)
 * ราคาแบบ "295/395" คือ 2 ราคาตามเล่มเมนู (เจ้าหน้าที่ยืนยันว่าถูกต้องแล้ว)
 */
const MENU_DOC = 'เล่มเมนูอาหารบ้านโฮม BH 2026';

// [หมวด, ชื่อไทย, ชื่ออังกฤษ, ราคา, รายละเอียดจากเล่มเมนู(ถ้ามี), หน้า]
type Dish = [string, string, string, string, string, number];

const DISHES: Dish[] = [
  // เมนูแนะนำ / Signature
  ['เมนูแนะนำ', 'ลาบปลาตะเพียน', 'Spicy Silver Barb Laab', '300', 'ปลาตะเพียนทอดกรอบคลุกเคล้าลาบสมุนไพรอีสาน หอมข้าวคั่ว รสจัดจ้าน เสิร์ฟพร้อมผักพื้นบ้านแบบบ้านโฮม (Signature)', 4],
  ['เมนูแนะนำ', 'ผักพื้นบ้านแบบบ้านโฮม', 'Local Vegetables Baan Home Style', '300', '', 4],
  ['เมนูแนะนำ', 'ขาหมูบ้านโฮม', 'German Pork Knuckle', '495', 'หนังกรอบ เนื้อนุ่มฉ่ำ สูตรเฉพาะของบ้านโฮม (Best Seller)', 4],
  ['เมนูแนะนำ', 'เมี่ยงปลานิลฟู', 'Crispy Tilapia Miang', '295', 'ปลานิลสดจากเขื่อนลำปาว ทำกรอบฟู เสิร์ฟพร้อมผักท้องถิ่นและเครื่องเมี่ยง สูตรเฉพาะของบ้านโฮม', 4],
  ['เมนูแนะนำ', 'กุ้งแพทอด', 'Crispy Shrimp Fritters', '165', 'สูตรคุณย่า ใช้กุ้งฝอยสดจากเขื่อนลำปาว เคล้าเครื่องแกงแบบต้นตำรับ (Best Seller)', 4],
  ['เมนูแนะนำ', 'บาร์บีคิวซี่โครงหมู ไซซ์ S', 'BBQ Pork Ribs (S)', '365', 'ซี่โครงหมักสูตรพิเศษของบ้านโฮม ย่างหอมกลมกล่อม เสิร์ฟพร้อมผักย่างและน้ำจิ้ม (Best Seller)', 5],
  ['เมนูแนะนำ', 'บาร์บีคิวซี่โครงหมู ไซซ์ L', 'BBQ Pork Ribs (L)', '635', 'ซี่โครงหมักสูตรพิเศษของบ้านโฮม ย่างหอมกลมกล่อม เสิร์ฟพร้อมผักย่างและน้ำจิ้ม', 5],
  ['เมนูแนะนำ', 'ยำตะไคร้ปลาย่าง', 'Grilled Fish with Spicy Lemongrass Salad', '265', 'ปลานิลเนื้อดีจากลำปาว ย่างสุกหอม เคล้ายำตะไคร้รสเด็ด (Signature)', 5],
  ['เมนูแนะนำ', 'ปลานิลย่างซอสงา ผักก้านจอง', 'Grilled Tilapia with Sesame Sauce and Rice Paddy Herbs', '265', 'ปลานิลคุณภาพจากเขื่อนลำปาว ย่างหอมด้วยซอสงา เสิร์ฟคู่ผักก้านจองสด', 5],
  ['เมนูแนะนำ', 'ปลาช่อนนึ่ง ผักลวก ตำแจ่ว', 'Steamed Snakehead Fish with Blanched Vegetables and Spicy Chili Dipping Sauce', '395', 'เมนูพื้นบ้านอีสานที่ต้องลอง ปลานึ่งเนื้อนุ่ม เสิร์ฟคู่ผักลวกและตำแจ่วรสแซ่บ', 6],
  ['เมนูแนะนำ', 'น้ำพริกเห็ดกุ้งย่าง', 'Mushroom Chili Paste with Grilled Shrimp', '265', 'น้ำพริกเห็ดแบบอีสาน หอมกลิ่นเห็ดย่างและสมุนไพร เสิร์ฟคู่กุ้งย่างกาฬสินธุ์พร้อมผักตามฤดูกาล', 6],

  // กุ้ง GI กาฬสินธุ์
  ['กุ้ง GI กาฬสินธุ์', 'กุ้งภูเขาไฟ', 'Volcano Grilled River Prawns', '350', 'เมนูสุดพิเศษ ใครมาต้องลอง อร่อยจัดจ้านถึงใจ สูตรเฉพาะบ้านโฮม', 7],
  ['กุ้ง GI กาฬสินธุ์', 'กุ้งเผา', 'Grilled River Prawns', '300/495', '', 7],
  ['กุ้ง GI กาฬสินธุ์', 'ต้มยำกุ้งแม่น้ำ น้ำข้น/น้ำใส', 'Tom Yum Soup with Prawns Creamy/Clear', '395', '', 7],
  ['กุ้ง GI กาฬสินธุ์', 'กุ้งผัดพริกเกลือ', 'Stir-Fried Prawns with Chili, Garlic and Salt', '395', '', 7],
  ['กุ้ง GI กาฬสินธุ์', 'กุ้งซอสมะขาม', 'Prawns with Tamarind Sauce', '395', 'รสเปรี้ยวหวานกลมกล่อม หอมกลิ่นซอสมะขาม', 7],

  // เมี่ยงบ้านโฮม
  ['เมี่ยงบ้านโฮม', 'เมี่ยงไก่ย่าง', 'Thai-Style Lettuce Wraps with Grilled Chicken', '365', 'ห่อด้วยผักสดนานาชนิด', 8],
  ['เมี่ยงบ้านโฮม', 'เมี่ยงคอหมูย่าง', 'Thai-Style Lettuce Wraps with Grilled Pork Neck', '395', 'ห่อด้วยผักสดนานาชนิด', 8],
  ['เมี่ยงบ้านโฮม', 'เมี่ยงกุ้งย่าง', 'Thai-Style Lettuce Wraps with Grilled Prawns', '495', 'ห่อด้วยผักสดนานาชนิด', 8],
  ['เมี่ยงบ้านโฮม', 'เมี่ยงปลาย่าง', 'Thai-Style Lettuce Wraps with Grilled Fish', '295', 'ห่อด้วยผักสดนานาชนิด', 8],

  // ผัดไทย
  ['ผัดไทย', 'ผัดไทยปลาฟู', 'Pad Thai with Crispy Fish Flakes', '185', 'ผัดไทยรสกลมกล่อม ท็อปด้วยปลาฟูกรอบ หอมหวานมัน (Signature)', 9],
  ['ผัดไทย', 'ผัดไทยกุ้งก้ามกราม', 'River Prawn Pad Thai', '265', 'กุ้งก้ามกรามตัวใหญ่ เนื้อแน่น มันหวาน รสเข้มข้น', 9],
  ['ผัดไทย', 'ผัดไทยกุ้งสด', 'Pad Thai with Fresh Shrimp', '185', 'กุ้งสดเนื้อเด้งหวาน รสกลมกล่อม หอมมัน', 9],
  ['ผัดไทย', 'ผัดไทยไก่', 'Pad Thai with Chicken', '125', 'ไก่นุ่มหมักสูตรพิเศษ รสชาติกลมกล่อม', 9],
  ['ผัดไทย', 'ผัดไทยหมู', 'Pad Thai with Pork', '125', 'หมูนุ่มผัดกับเส้นนุ่ม รสเข้มข้น กลมกล่อม ถูกใจทุกวัย', 9],

  // ปลาย่างซอส (ปลานิล/ปลากะพง)
  ['ปลาย่างซอส', 'ปลานิล/ปลากะพง ซอสงา ผักก้านจอง', 'Grilled Fish with Sesame Sauce and Kang Jong', '265/295', 'ซอสงาหอมมัน กลมกล่อม เข้ากับผักก้านจองย่างไฟ (265 = ปลานิล, 295 = ปลากะพง)', 10],
  ['ปลาย่างซอส', 'ปลานิล/ปลากะพง ซอสสับปะรด', 'Grilled Tilapia / Sea Bass with Pineapple Sauce', '265/295', 'ซอสสับปะรดเปรี้ยวหวาน หอมสดชื่น (265 = ปลานิล, 295 = ปลากะพง)', 10],
  ['ปลาย่างซอส', 'ปลานิล/ปลากะพง ซอสพริกไทยดำ', 'Grilled Tilapia / Sea Bass with Black Pepper Sauce', '265/295', 'ซอสพริกไทยดำเข้มข้น เผ็ดหอมร้อนแรง (265 = ปลานิล, 295 = ปลากะพง)', 10],
  ['ปลาย่างซอส', 'ปลานิล/ปลากะพง ยำตะไคร้', 'Grilled Tilapia / Sea Bass with Lemongrass Salad', '265/295', 'ยำตะไคร้แซ่บจัดจ้าน (265 = ปลานิล, 295 = ปลากะพง)', 10],
  ['ปลาย่างซอส', 'ปลานิล/ปลากะพง ซอสยำมะม่วง', 'Grilled Tilapia / Sea Bass with Spicy Mango Salad', '265/295', 'ซอสยำมะม่วงเปรี้ยวจี๊ด เผ็ดนิดๆ (265 = ปลานิล, 295 = ปลากะพง)', 10],

  // ปลาแม่น้ำลำปาว
  ['ปลาลำปาว', 'ต้มปลาญอนลำปาว', 'Isan-Style Lam Pao River Fish Soup', '295', 'ปลาญอนสดต้มกับสมุนไพรในน้ำซุปรสกลมกล่อม (Best Seller)', 11],
  ['ปลาลำปาว', 'ปลาญอนทอดกระเทียม', 'Deep-Fried Lam Pao River Fish with Garlic', '295', '', 11],
  ['ปลาลำปาว', 'หมกหม้อปลาญอน', 'Isan-Style Steamed River Fish with Herbs', '295', '', 11],
  ['ปลาลำปาว', 'ปลาส้มทอดทรงเครื่อง', 'Deep-Fried Fermented Fish with Thai Herbs', '220', '', 11],
  ['ปลาลำปาว', 'หมกหม้อไข่ปลาตะเพียน', 'Isan-Style Steamed Silver Barb Roe with Herbs', '180', '', 11],

  // ปลาช่อน
  ['ปลาช่อน', 'ปลาช่อนบ้านโฮม', 'Baan Home-Style Snakehead Fish', '395', '', 12],
  ['ปลาช่อน', 'ปลาช่อนทอดสมุนไพร', 'Fried Snakehead Fish with Herbs', '395', '', 12],
  ['ปลาช่อน', 'ปลาช่อนยำตะไคร้', 'Fried Snakehead Fish with Lemongrass Salad', '395', '', 12],
  ['ปลาช่อน', 'ปลาช่อนผัดขึ้นฉ่าย', 'Stir-Fried Snakehead Fish with Chinese Celery', '265', '', 12],
  ['ปลาช่อน', 'ปลาช่อนผัดฉ่า', 'Stir-Fried Spicy Snakehead Fish with Herbs', '265', '', 12],
  ['ปลาช่อน', 'ปลาช่อนคั่วพริกเกลือ', 'Stir-Fried Snakehead Fish with Chili and Salt', '395', '', 12],
  ['ปลาช่อน', 'แกงส้มแป๊ะซะปลาช่อน', 'Kaeng Som Pae Sa-Style Snakehead Fish', '395', '', 12],
  ['ปลาช่อน', 'ปลาช่อนลุยสวน', 'Crispy Snakehead Fish with Thai Herb Salad', '395', '', 12],

  // ปลานิล
  ['ปลานิล', 'ปลานิลนึ่ง ผักลวก ตำแจ่ว', 'Steamed Tilapia and Blanched Vegetables with Spicy Isan Dipping Sauce', '365', 'เมนูปลาเพื่อสุขภาพ เนื้อปลาหวานนุ่มไม่มีกลิ่นคาว กินคู่กับผักลวกและน้ำจิ้มแจ่วรสแซ่บ (Best Seller)', 13],
  ['ปลานิล', 'ปลานิลบ้านโฮม', 'Baan Home-Style Tilapia', '365', '', 13],
  ['ปลานิล', 'ปลานิลนึ่งมะนาว', 'Steamed Tilapia with Spicy Garlic and Lime Sauce', '365', '', 13],
  ['ปลานิล', 'ปลานิลลุยสวน', 'Deep-Fried Tilapia with Spicy Herb Salad', '365', '', 13],
  ['ปลานิล', 'ปลานิลทอดน้ำปลา', 'Deep-Fried Tilapia with Premium Fish Sauce', '365', '', 13],
  ['ปลานิล', 'ปลานิลทอดสมุนไพร', 'Deep-Fried Tilapia with Crispy Thai Herbs', '265', '', 13],
  ['ปลานิล', 'ปลานิลยำตะไคร้', 'Deep-Fried Tilapia with Spicy Lemongrass Salad', '265', '', 13],
  ['ปลานิล', 'ปลานิลผัดขึ้นฉ่าย', 'Stir-Fried Tilapia with Chinese Celery', '265', '', 13],
  ['ปลานิล', 'ปลานิลผัดฉ่า', 'Stir-Fried Spicy Tilapia with Fingerroot and Herbs', '265', '', 13],
  ['ปลานิล', 'ต้มยำปลานิล น้ำข้น/น้ำใส', 'Tilapia Tom Yum Soup (Creamy or Clear)', '265', '', 13],
  ['ปลานิล', 'ปลานิลคั่วพริกเกลือ', 'Stir-Fried Tilapia with Chili and Salt', '265', '', 13],
  ['ปลานิล', 'ปลานิลสามรส', 'Deep-Fried Tilapia with Sweet, Sour, and Spicy Sauce', '265', '', 13],

  // ปลากะพง
  ['ปลากะพง', 'ปลากะพงทอดน้ำปลา', 'Deep-Fried Sea Bass with Premium Fish Sauce', '395', 'เมนูยอดนิยม เนื้อปลากรอบนอกนุ่มใน ราดด้วยซอสน้ำปลาเค็มหวานกลมกล่อม (Best Seller)', 14],
  ['ปลากะพง', 'ปลากะพงบ้านโฮม', 'Baan Home Style Sea Bass', '395', '', 14],
  ['ปลากะพง', 'ปลากะพงยำตะไคร้', 'Deep-Fried Sea Bass with Spicy Lemongrass Salad', '295/395', '', 14],
  ['ปลากะพง', 'ปลากะพงสามรส', 'Deep-Fried Sea Bass with Sweet, Sour, and Spicy Sauce', '295/395', '', 14],
  ['ปลากะพง', 'ต้มยำน้ำข้นปลากะพง', 'Creamy Tom Yum Soup (Sea Bass)', '295/395', '', 14],
  ['ปลากะพง', 'ต้มยำน้ำใสปลากะพง', 'Clear Tom Yum Soup (Sea Bass)', '295/395', '', 14],
  ['ปลากะพง', 'ต้มส้มไข่มดแดง', 'Sour Soup with Ant Eggs and Thai Herbs', '359/459', '', 14],
  ['ปลากะพง', 'ปลากะพงนึ่งมะนาว', 'Steamed Sea Bass with Spicy Garlic and Lime Sauce', '395', '', 14],
  ['ปลากะพง', 'ต้มปลาผักกะแยง', 'Isan-Style Fish Soup with Paddy Herb', '295/395', '', 14],
  ['ปลากะพง', 'ปลากะพงคั่วพริกเกลือ', 'Crispy Stir-Fried Sea Bass with Chili and Salt', '295/395', '', 14],
  ['ปลากะพง', 'ปลากะพงผัดฉ่า', 'Stir-Fried Spicy Sea Bass with Fingerroot and Herbs', '295/395', '', 14],

  // ผัด
  ['เมนูผัด', 'กระเจี๊ยบน้ำมันหอย', 'Stir-Fried Okra with Oyster Sauce', '125', 'กระเจี๊ยบเขียวสดผัดน้ำมันหอย รสกลมกล่อม หอมกระเทียม (Best Seller)', 15],
  ['เมนูผัด', 'ผักปลังน้ำมันหอย', 'Stir-Fried Malabar Spinach with Oyster Sauce', '125', '', 15],
  ['เมนูผัด', 'ก้านจองน้ำมันหอย', 'Stir-Fried Yellow Velvetleaf Stems with Oyster Sauce', '125', '', 15],
  ['เมนูผัด', 'ผัดผักบุ้งไฟแดง', 'Stir-Fried Water Spinach', '125', '', 15],
  ['เมนูผัด', 'บล็อคโคลี่น้ำมันหอย', 'Stir-Fried Broccoli with Oyster Sauce', '165', '', 15],
  ['เมนูผัด', 'คะน้าน้ำมันหอย', 'Stir-Fried Chinese Kale with Oyster Sauce', '165', '', 15],
  ['เมนูผัด', 'ผัดผักรวมน้ำมันหอย', 'Stir-Fried Mixed Vegetables with Oyster Sauce', '220', '', 15],
  ['เมนูผัด', 'ผัดผักรวมน้ำมันหอยหมู/กุ้ง', 'Stir-Fried Mixed Vegetables with Pork or Shrimp in Oyster Sauce', '265/295', '265 = หมู, 295 = กุ้ง', 15],

  // ทอด
  ['เมนูทอด', 'หมูแดดเดียว', 'Sun-Dried Pork', '165', '', 16],
  ['เมนูทอด', 'เอ็นไก่กระชาย', 'Crispy Chicken Tendons with Fingerroot', '165', '', 16],
  ['เมนูทอด', 'ปีกไก่ทอด', 'Crispy Fried Chicken Wings', '165', '', 16],
  ['เมนูทอด', 'ออร์เดิร์ฟบ้านโฮม', 'Baan Home Appetizer Platter', '395', '', 16],
  ['เมนูทอด', 'ปลากรอบแก้ว', 'Crispy Thai Anchovies', '165', '', 16],
  ['เมนูทอด', 'เฟรนช์ฟรายส์', 'French Fries', '165', '', 16],

  // ยำ
  ['เมนูยำ', 'ยำรวมมิตรทะเล', 'Spicy Mixed Seafood Salad', '295', 'รวมอาหารทะเลสด คลุกน้ำยำรสเด็ด (Best Seller)', 17],
  ['เมนูยำ', 'ยำเห็ดรวมทะเล', 'Spicy Mixed Mushroom and Seafood Salad', '265', '', 17],
  ['เมนูยำ', 'ยำวุ้นเส้นโบราณ', 'Traditional Thai Glass Noodle Salad', '220', '', 17],
  ['เมนูยำ', 'ยำถั่วพูบ้านโฮม', 'Homemade Spicy Winged Bean Salad', '265', '', 17],
  ['เมนูยำ', 'ยำหมูยอ', 'Spicy Vietnamese Pork Sausage Salad', '220', '', 17],
  ['เมนูยำ', 'ยำมาม่าหมูสับ/ทะเล', 'Instant Noodle Salad with Minced Pork / Seafood', '220/265', '220 = หมูสับ, 265 = ทะเล', 17],
  ['เมนูยำ', 'ยำวุ้นเส้นรวมมิตร', 'Spicy Seafood Glass Noodle Salad', '265', '', 17],
  ['เมนูยำ', 'ยำตะไคร้กุ้งสด', 'Spicy Lemongrass Salad with Shrimp', '265', '', 17],

  // ส้มตำ
  ['เมนูส้มตำ', 'ส้มตำกุ้งสุก/สด', 'Papaya Salad with Shrimp (Cooked or Raw Shrimp)', '265', 'เส้นมะละกอสดกรอบ คลุกเคล้ารสเปรี้ยว เผ็ด เค็ม หวาน (Best Seller)', 18],
  ['เมนูส้มตำ', 'ตำไทย', 'Thai-Style Papaya Salad', '95', '', 18],
  ['เมนูส้มตำ', 'ตำลาว', 'Lao-Style Papaya Salad', '95', '', 18],
  ['เมนูส้มตำ', 'ตำซั่ว', 'Papaya Salad with Rice Noodles', '95', '', 18],
  ['เมนูส้มตำ', 'ตำถั่ว', 'Spicy Long Bean Salad', '95', '', 18],
  ['เมนูส้มตำ', 'ตำแตงไข่ต้ม', 'Spicy Cucumber Salad with Boiled Eggs', '165', '', 18],
  ['เมนูส้มตำ', 'แคบหมูระเบิด', 'Pork Cracklings', '35', '', 18],
  ['เมนูส้มตำ', 'เครื่องเคียงส้มตำ (ไข่ต้ม ขนมจีน หมี่ขาว เส้นเล็กลวก มาม่าลวก)', 'Side Dishes: Boiled Eggs, Thai Rice Vermicelli, Blanched Noodles', '25', 'ทุกเมนูเครื่องเคียงราคาอย่างละ 25 บาท', 18],

  // เซตไก่
  ['เซตไก่สุดคุ้ม', 'ชุดอิ่มคุ้ม (เซตไก่ย่างใหญ่)', 'Set: Large Grilled Chicken, Lao-Style Papaya Salad, Shrimp Pad Thai, Clear Soup with Tilapia', '555', 'ไก่ย่างใหญ่ + ส้มตำลาว + ผัดไทยกุ้ง + ต้มปลานิลน้ำใส', 19],
  ['เซตไก่สุดคุ้ม', 'ชุดอิ่มสุข (เซตไก่ย่างเล็ก)', 'Set: Small Grilled Chicken, Papaya Salad, Pad Thai with Crispy Fish Flakes', '259', 'ไก่ย่างเล็ก + ส้มตำ + ผัดไทยปลาฟู', 19],

  // ไก่
  ['เมนูไก่', 'ไก่บ้านนึ่งสมุนไพร', 'Steamed Country Chicken with Herbs', '265/495', 'ไก่บ้านเนื้อแน่น นึ่งพร้อมสมุนไพรพื้นบ้าน หอมกลิ่นเครื่องเทศ รสเข้มข้นกลมกล่อมแบบอีสานแท้', 20],
  ['เมนูไก่', 'ต้มไก่บ้าน', 'Spicy Country Chicken Soup', '265/495', '', 20],
  ['เมนูไก่', 'แกงไก่ใส่วุ้นเส้น', 'Country Chicken Curry with Glass Noodles', '265/495', '', 20],
  ['เมนูไก่', 'ไก่บ้านผัดพริกสดโหระพา', 'Stir-Fried Country Chicken with Fresh Chili and Thai Basil', '265/495', '', 20],
  ['เมนูไก่', 'อ่อมไก่บ้าน', 'Isan-Style Country Chicken Herb Soup', '265/495', '', 20],
  ['เมนูไก่', 'ไก่ผัดเม็ดมะม่วง', 'Stir-Fried Chicken with Cashew Nuts', '265', '', 20],
  ['เมนูไก่', 'ไก่ผัดกะเพราพริกแห้ง', 'Stir-Fried Chicken with Holy Basil and Dried Chili', '220', '', 20],

  // เนื้อ
  ['เมนูเนื้อ', 'เสือย่าง', 'Charcoal-Grilled Beef', '265', 'เนื้อวัว Grass-fed คัดพิเศษ ย่างหอมกลิ่นเตาถ่าน แล่เป็นชิ้นพอดีคำ เนื้อนุ่มฉ่ำ เสิร์ฟคู่แจ่วรสแซ่บ', 21],
  ['เมนูเนื้อ', 'เสือครวญ', 'Spicy Grilled Beef', '265', '', 21],
  ['เมนูเนื้อ', 'ต้มแซ่บเนื้อ', 'Spicy Beef Soup', '265', '', 21],
  ['เมนูเนื้อ', 'อ่อมเนื้อ', 'Isan-Style Beef Soup with Herb', '265', '', 21],
  ['เมนูเนื้อ', 'เสือคั่วกะเพรา', 'Stir-Fried Spicy Beef with Holy Basil', '265', '', 21],

  // จานเดี่ยว
  ['อาหารจานเดี่ยว', 'ไข่เจียว', 'Rice with Thai-style Omelet', '85/120', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ไข่เจียวหมูสับ', 'Rice with Minced Pork Omelet', '95/129', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ไข่เจียวหมูสับโหระพา', 'Rice with Pork and Thai Basil Omelet', '95/129', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ไข่เจียวกุ้งสับ', 'Rice with Minced Shrimp Omelet', '120/150', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ไข่เจียวกุ้งโหระพา', 'Rice with Shrimp and Thai Basil Omelet', '120/165', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ข้าวผัดหมู', 'Pork Fried Rice', '85/220', '', 22],
  ['อาหารจานเดี่ยว', 'ข้าวผัดไก่', 'Chicken Fried Rice', '85/220', '', 22],
  ['อาหารจานเดี่ยว', 'ข้าวผัดกุ้ง/รวม', 'Shrimp / Mixed Fried Rice', '120/265', '', 22],
  ['อาหารจานเดี่ยว', 'กะเพราหมู/ไก่', 'Rice with Pork / Chicken Stir-Fried Holy Basil', '85/185', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'กะเพราทะเล/รวม', 'Rice with Seafood / Mixed Stir-Fried Holy Basil', '120/265', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ผัดฉ่าหมู/ไก่', 'Rice with Pork / Chicken Spicy Herb Stir-Fry', '85/185', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'ผัดฉ่าทะเล/รวม', 'Rice with Seafood / Mixed Spicy Herb Stir-Fry', '120/185', 'ราคาตามเล่มเมนู: ราดข้าว/กับข้าว', 22],
  ['อาหารจานเดี่ยว', 'มาม่าผัดขี้เมาหมู/ไก่', 'Stir-Fried Mama Noodles Drunken with Pork / Chicken', '85', '', 22],
  ['อาหารจานเดี่ยว', 'มาม่าผัดขี้เมาทะเล/รวม', 'Stir-Fried Mama Noodles with Seafood / Mixed', '165', '', 22],
  ['อาหารจานเดี่ยว', 'ข้าวสวย (จาน)', 'Steamed Rice (Plate)', '15', '', 22],
  ['อาหารจานเดี่ยว', 'ข้าวสวย (โถ)', 'Steamed Rice (Bowl)', '75', '', 22],
  ['อาหารจานเดี่ยว', 'ข้าวเหนียว (กระติบ)', 'Sticky Rice (Basket)', '20', '', 22],
  ['อาหารจานเดี่ยว', 'ไข่ดาว (1 ฟอง)', 'Fried Egg', '15', '', 22],
];

// รูปสะกดที่พนักงานมักพิมพ์ต่างกัน (น้ำ / นํ้า, ลำ / ลํา, ตำ / ตํา)
function spellingVariants(text: string): string[] {
  const alt = text.replace(/น้ำ/g, 'นํ้า').replace(/ลำ/g, 'ลํา').replace(/ตำ/g, 'ตํา').replace(/ยำ/g, 'ยํา');
  return alt === text ? [] : [alt];
}

function buildItem(d: Dish, index: number): KnowledgeItem {
  const [category, nameTh, nameEn, price, desc, page] = d;
  const priceText = price.includes('/') ? price.split('/').map((p) => `${p}.-`).join('/') : `${price}.-`;
  const hasTwoPrices = price.includes('/');
  const baseName = nameTh.replace(/\s*\(.*?\)\s*/g, '').trim();

  const customerMessage =
    `${nameTh} ราคา ${priceText} ค่ะ 💚` +
    (desc ? ` ${desc.replace(/\s*\((Best Seller|Signature)\)/g, '')}` : '') +
    (hasTwoPrices && !desc.includes('=') ? ' (ราคาตามเล่มเมนู)' : '');

  return {
    id: `MENU-${String(index + 1).padStart(3, '0')}`,
    category: 'restaurant',
    audience: 'Both',
    title: `เมนู ${nameTh} (${priceText})`,
    keywords: [
      nameTh,
      baseName,
      ...spellingVariants(nameTh),
      nameEn.toLowerCase(),
      category,
      `ราคา${baseName}`,
      `${baseName}ราคา`,
      'เมนู',
      'ราคาอาหาร',
    ],
    summary: `${nameTh} ${priceText} (หมวด${category})`,
    detail: [
      `ชื่อเมนู: ${nameTh} / ${nameEn}`,
      `หมวด: ${category}`,
      `ราคา: ${priceText}${hasTwoPrices ? ' (2 ราคาตามเล่มเมนู ยืนยันถูกต้องแล้ว)' : ''}`,
      ...(desc ? [`รายละเอียด: ${desc}`] : []),
    ],
    customerMessage,
    nextActions: ['ถามจำนวนที่นั่ง/วันเวลา หรือเสนอเมนูเสริมที่เข้ากัน'],
    sourceDoc: MENU_DOC,
    docSection: `หน้า ${page}`,
    lastUpdated: '2026-10-08',
    status: 'Published',
    dataStatus: 'Confirmed',
    aiUsable: 'Yes',
  };
}

export const MENU_DISH_ITEMS: KnowledgeItem[] = DISHES.map(buildItem);
