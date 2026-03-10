(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,10607,e=>{"use strict";let i=[{id:"cairo",name:"القاهرة",nameEn:"Cairo",shipping:50},{id:"giza",name:"الجيزة",nameEn:"Giza",shipping:50},{id:"qalyubia",name:"القليوبية",nameEn:"Qalyubia",shipping:55},{id:"alexandria",name:"الإسكندرية",nameEn:"Alexandria",shipping:65},{id:"sharqia",name:"الشرقية",nameEn:"Sharqia",shipping:65},{id:"dakahlia",name:"الدقهلية",nameEn:"Dakahlia",shipping:65},{id:"gharbia",name:"الغربية",nameEn:"Gharbia",shipping:65},{id:"monufia",name:"المنوفية",nameEn:"Monufia",shipping:65},{id:"suez",name:"السويس",nameEn:"Suez",shipping:65},{id:"ismailia",name:"الإسماعيلية",nameEn:"Ismailia",shipping:65},{id:"port-said",name:"بورسعيد",nameEn:"Port Said",shipping:65},{id:"beheira",name:"البحيرة",nameEn:"Beheira",shipping:70},{id:"damietta",name:"دمياط",nameEn:"Damietta",shipping:70},{id:"kafr-sheikh",name:"كفر الشيخ",nameEn:"Kafr el-Sheikh",shipping:70},{id:"fayoum",name:"الفيوم",nameEn:"Fayoum",shipping:70},{id:"beni-suef",name:"بني سويف",nameEn:"Beni Suef",shipping:80},{id:"minya",name:"المنيا",nameEn:"Minya",shipping:80},{id:"asyut",name:"أسيوط",nameEn:"Asyut",shipping:85},{id:"sohag",name:"سوهاج",nameEn:"Sohag",shipping:85},{id:"qena",name:"قنا",nameEn:"Qena",shipping:90},{id:"luxor",name:"الأقصر",nameEn:"Luxor",shipping:90},{id:"aswan",name:"أسوان",nameEn:"Aswan",shipping:95},{id:"red-sea",name:"البحر الأحمر",nameEn:"Red Sea",shipping:95},{id:"north-sinai",name:"شمال سيناء",nameEn:"North Sinai",shipping:95},{id:"south-sinai",name:"جنوب سيناء",nameEn:"South Sinai",shipping:100},{id:"matruh",name:"مطروح",nameEn:"Matruh",shipping:100},{id:"new-valley",name:"الوادي الجديد",nameEn:"New Valley",shipping:100}];function t(e){return i.find(i=>i.id===e)?.shipping??80}e.s(["getShipping",()=>t,"governorates",0,i])},70820,e=>{"use strict";var i=e.i(4662);function t(){try{let e=localStorage.getItem("ml-coupons");if(e)return JSON.parse(e)}catch{}return{...i.DEFAULT_COUPONS}}function r(e){localStorage.setItem("ml-coupons",JSON.stringify(e))}function a(e,i){let a=t();a[e.toUpperCase().trim()]=i,r(a)}function l(e){let i=t();delete i[e],r(i)}function n(){try{let e=localStorage.getItem("ml_users");if(!e)return[];let i=JSON.parse(e);return Object.values(i).map(({user:e})=>{let i=s(e.id);return{id:e.id,name:e.name,email:e.email,phone:e.phone,orderCount:i.length}})}catch{return[]}}function s(e){try{let i=localStorage.getItem(`ml_orders_${e}`);if(!i)return[];let t=JSON.parse(i),r=localStorage.getItem("ml_users"),a="",l="";if(r){let i=JSON.parse(r),t=Object.values(i).find(i=>i.user.id===e);t&&(a=t.user.name,l=t.user.email)}let n=d();return t.map(i=>({...i,status:n[i.id]||i.status,userId:e,userName:a,userEmail:l}))}catch{return[]}}function o(){try{let e=localStorage.getItem("ml_users");if(!e)return[];let i=JSON.parse(e),t=[];return Object.values(i).forEach(({user:e})=>{t.push(...s(e.id))}),t.sort((e,i)=>i.id.localeCompare(e.id))}catch{return[]}}function d(){try{let e=localStorage.getItem("ml-order-status");if(e)return JSON.parse(e)}catch{}return{}}function c(e,i){let t=d();t[e]=i,localStorage.setItem("ml-order-status",JSON.stringify(t))}function p(){try{let e=localStorage.getItem("ml-product-overrides");if(e)return JSON.parse(e)}catch{}return{}}function g(e,i){let t=p();t[e]={...t[e],...i},localStorage.setItem("ml-product-overrides",JSON.stringify(t))}function h(){try{let e=localStorage.getItem("ml-products-added");if(e)return JSON.parse(e)}catch{}return[]}function m(e){localStorage.setItem("ml-products-added",JSON.stringify(e))}function u(e){let i=h();i.unshift(e),m(i)}function b(e){m(h().filter(i=>i.id!==e))}function x(e){let i=[];return e.forEach(({id:e,name:t})=>{try{let r=localStorage.getItem(`reviews_${e}`);if(!r)return;JSON.parse(r).forEach(r=>i.push({...r,productId:e,productName:t}))}catch{}}),i.sort((e,i)=>i.date.localeCompare(e.date))}function y(e,i){try{let t=localStorage.getItem(`reviews_${e}`);if(!t)return;let r=JSON.parse(t).filter(e=>e.id!==i);localStorage.setItem(`reviews_${e}`,JSON.stringify(r))}catch{}}function f(){try{let e=localStorage.getItem("ml-shipping-overrides");if(e)return JSON.parse(e)}catch{}return{local:{}}}function w(e){localStorage.setItem("ml-shipping-overrides",JSON.stringify(e))}e.i(10607),e.s(["addCoupon",()=>a,"addProduct",()=>u,"deleteAddedProduct",()=>b,"deleteCoupon",()=>l,"deleteReview",()=>y,"getAddedProducts",()=>h,"getAllOrders",()=>o,"getAllReviews",()=>x,"getAllUsers",()=>n,"getCoupons",()=>t,"getProductOverrides",()=>p,"getShippingOverrides",()=>f,"getUserOrders",()=>s,"saveAddedProducts",()=>m,"saveShippingOverrides",()=>w,"setOrderStatus",()=>c,"setProductOverride",()=>g])},65721,e=>{"use strict";let i="https://moslimleader.com/wp-content/uploads",t=[{id:"1",slug:"feast-day-game",name:"لعبة يوم الصائم",nameEn:"The Fasting Day Game",shortDescription:"لعبة لوحية جماعية يلعبها لاعبين فأكثر",shortDescriptionEn:"A group board game for 2 or more players",description:`<p>لعبة لوحية جماعية تساعد الأطفال على تعلم قيم الصيام بطريقة ممتعة وتفاعلية.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (4 \xd7 32.5 \xd7 25 سم)</li>
  <li>لوحة من الكرتون المقوى (43 \xd7 30.5 سم)</li>
  <li>6 كروت مجموعتين (9 \xd7 5 سم)</li>
  <li>4 فيشات بلاستيك</li>
  <li>جدول متابعة يومي</li>
  <li>سيسكة إلكترونية</li>
</ul>`,descriptionEn:`<p>A group board game that helps children learn the values of fasting in a fun and interactive way.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (4 \xd7 32.5 \xd7 25 cm)</li>
  <li>Heavy cardboard board (43 \xd7 30.5 cm)</li>
  <li>6 cards in 2 sets (9 \xd7 5 cm)</li>
  <li>4 plastic tokens</li>
  <li>Daily tracking chart</li>
  <li>Electronic buzzer</li>
</ul>`,price:230,category:"ألعاب تعليمية",tags:["لعبة","صيام","رمضان","تربوية"],images:[`${i}/2024/07/Feast-Day-1.webp`,`${i}/2024/07/Feast-Day-2.webp`,`${i}/2024/07/Feast-Day-3.webp`,`${i}/2024/07/Feast-Day-4.webp`,`${i}/2024/07/Feast-Day-5.webp`,`${i}/2024/07/Feast-Day-6.webp`],inStock:!0,videos:["4Z7asM6e9IM","PkF7SmB8k_E"],weight:540,reviews:[{id:"r1-1",author:"أم محمد",rating:5,comment:"لعبة رائعة جداً، أولادي استمتعوا بيها كتير وتعلموا قيم الصيام بطريقة ممتعة. جودة ممتازة وشكل جميل.",commentEn:"Amazing game! My kids loved it and learned fasting values in a fun way. Excellent quality.",date:"2024-03-15",verified:!0},{id:"r1-2",author:"سارة أحمد",rating:5,comment:"اشتريتها هدية لابن أختي وأعجبتهم جداً. التغليف محترم والألوان جميلة.",date:"2024-02-20",verified:!0},{id:"r1-3",author:"خالد عبدالله",rating:4,comment:"لعبة تعليمية ممتازة. اللعبة محفزة للأطفال على الصيام. أنصح بيها.",date:"2024-01-10",verified:!1}]},{id:"2",slug:"leader-medal",name:"وسام القائد",nameEn:"The Leader's Medal",shortDescription:"لوحة أوسمة لمهام القائد",shortDescriptionEn:"A medals board for leader tasks",description:`<p>لوحة أوسمة تحفيزية تساعد الأطفال على إنجاز مهامهم اليومية وتطوير شخصيتهم القيادية.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (39 \xd7 50 \xd7 3.3 سم)</li>
  <li>20 كارت من الكرتون المقوى (7 \xd7 9.5 سم)</li>
  <li>لوحة الأوسمة (48 \xd7 32 سم)</li>
  <li>20 وسام (6 \xd7 6.5 سم تقريباً)</li>
  <li>شهادة تقدير تشجيعية A4</li>
  <li>ستيكر نجوم مستوى</li>
</ul>`,descriptionEn:`<p>A motivational medals board that helps children accomplish their daily tasks and develop their leadership character.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (39 \xd7 50 \xd7 3.3 cm)</li>
  <li>20 heavy cardboard cards (7 \xd7 9.5 cm)</li>
  <li>Medals board (48 \xd7 32 cm)</li>
  <li>20 medals (approx. 6 \xd7 6.5 cm)</li>
  <li>Encouraging appreciation certificate A4</li>
  <li>Level star stickers</li>
</ul>`,price:320,category:"ألعاب تعليمية",tags:["قيادة","تربية","شخصية"],images:[`${i}/2024/07/Leader-Medal.webp`,`${i}/2024/07/Leader-Medal-1.webp`,`${i}/2024/07/Leader-Medal-2.webp`,`${i}/2024/07/Leader-Medal-3.webp`,`${i}/2024/07/Leader-Medal-4.webp`,`${i}/2024/07/Leader-Medal-5.webp`,`${i}/2024/07/Leader-Medal-6.webp`],inStock:!0,weight:660,reviews:[{id:"r2-1",author:"ريم السيد",rating:5,comment:"من أجمل ما اشتريته لابني! شجعه على إتمام مهامه اليومية والصلاة. ممتاز جداً.",date:"2024-04-05",verified:!0},{id:"r2-2",author:"هدى محمود",rating:5,comment:"هدية مثالية لأي طفل. ابني فرح بيها جداً والأوسمة جميلة ومحفزة.",date:"2024-03-22",verified:!0}]},{id:"3",slug:"preparing-leaders",name:"إعداد القادة",nameEn:"Preparing Leaders",shortDescription:"كروت معلومات ونوتة وجدول مهام",shortDescriptionEn:"Info cards, notebook, and task schedule",description:`<p>مجموعة متكاملة لإعداد القائد المسلم الصغير من خلال كروت معلومات ثرية ونوتة ومهام يومية.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (4 \xd7 32.5 \xd7 25 سم)</li>
  <li>13 كارت من الكرتون المقوى (23 \xd7 16 سم)</li>
  <li>نوت بوك مسلم ليدر (15 \xd7 17 سم)</li>
  <li>جدول مهام القائد ورقي A3</li>
  <li>بادج مسلم ليدر</li>
</ul>`,descriptionEn:`<p>A comprehensive set for preparing the young Muslim leader through rich info cards, a notebook, and daily tasks.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (4 \xd7 32.5 \xd7 25 cm)</li>
  <li>13 heavy cardboard cards (23 \xd7 16 cm)</li>
  <li>Moslim Leader notebook (15 \xd7 17 cm)</li>
  <li>A3 leader task schedule</li>
  <li>Moslim Leader badge</li>
</ul>`,price:230,category:"ألعاب تعليمية",tags:["قيادة","تربية","تعليم"],images:[`${i}/2024/07/Muslim-Leaders-1.webp`,`${i}/2024/07/Muslim-Leaders-2.webp`,`${i}/2024/07/Muslim-Leaders-3.webp`],inStock:!0,weight:500,reviews:[{id:"r3-1",author:"منى إبراهيم",rating:4,comment:"محتوى تعليمي ممتاز. الكروت واضحة ومفيدة. ابني استمتع بيها.",date:"2024-02-14",verified:!0}]},{id:"4",slug:"pray-hajj-game",name:"لعبة الصلاة وقصة الحج",nameEn:"The Prayer & Hajj Game",shortDescription:"تطبيقان بتقنية AR لتعليم الصلاة والحج",shortDescriptionEn:"Two AR apps for learning prayer and Hajj",description:`<p>مجموعة تعليمية متكاملة تجمع بين اللعبة التفاعلية وتقنية الواقع المعزز AR لتعليم الصلاة ورحلة الحج.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (37 \xd7 28 \xd7 2.2 سم)</li>
  <li>لوحة تعلم الصلاة من الفوم (36.8 \xd7 28 \xd7 0.9 سم)</li>
  <li>لوح بازل من الفوم مطبوع وجهين (36.8 \xd7 28 \xd7 0.9 سم)</li>
  <li>كتيب تعلم رحلة الحج كاملة</li>
  <li>سجادة صلاة</li>
  <li>ورق شرح الاستخدام</li>
  <li>قلم White Board</li>
</ul>
<p><strong>التطبيقات مجانية على Google Play</strong></p>`,descriptionEn:`<p>A comprehensive educational set combining an interactive game and Augmented Reality (AR) technology to teach prayer and the Hajj journey.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (37 \xd7 28 \xd7 2.2 cm)</li>
  <li>Foam prayer learning board (36.8 \xd7 28 \xd7 0.9 cm)</li>
  <li>Double-sided printed foam puzzle board (36.8 \xd7 28 \xd7 0.9 cm)</li>
  <li>Complete Hajj journey learning booklet</li>
  <li>Prayer rug</li>
  <li>Usage instruction sheet</li>
  <li>White Board marker</li>
</ul>
<p><strong>Apps are free on Google Play</strong></p>`,price:250,category:"ألعاب تعليمية",tags:["صلاة","حج","تعليم","AR"],images:[`${i}/2024/07/Pray-and-Hajj-1.webp`,`${i}/2024/07/Pray-and-Hajj-2.webp`,`${i}/2024/07/Pray-and-Hajj-3.webp`,`${i}/2024/07/Pray-and-Hajj-4.webp`,`${i}/2024/07/Pray-and-Hajj-5.webp`,`${i}/2024/07/Pray-and-Hajj-6.webp`],inStock:!0,featured:!0,weight:617,reviews:[{id:"r4-1",author:"أم عمر",rating:5,comment:"منتج رائع! الـ AR مدهش وابني بيحب يستخدمه لتعلم الصلاة. أفضل هدية قدمتها.",commentEn:"Amazing product! The AR is stunning and my son loves using it to learn prayer. Best gift ever.",date:"2024-05-01",verified:!0},{id:"r4-2",author:"فاطمة علي",rating:5,comment:"اشتريتها لبنتي الصغيرة وهي مبسوطة بيها جداً. بتتعلم الصلاة وهي بتلعب.",date:"2024-04-18",verified:!0},{id:"r4-3",author:"أحمد محمود",rating:4,comment:"فكرة ممتازة وتنفيذ جيد. التطبيق شغال كويس. بنصح بيه للجميع.",date:"2024-03-30",verified:!1}]},{id:"5",slug:"puzzle-boys",name:"تكوين (أولاد)",nameEn:"Formation (Boys)",shortDescription:"بازل أولاد — 6 قطع لـ 6 أشكال مختلفة",shortDescriptionEn:"Boys' puzzle — 6 pieces for 6 different shapes",description:`<p>بازل تعليمي مخصص للأولاد يحتوي على 6 قطع بأشكال ملهمة تنمي مهارات التفكير والتركيز.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (3 \xd7 18 \xd7 18 سم)</li>
  <li>6 ألواح بازل من الورق المقوى (15 \xd7 15 سم)</li>
</ul>`,descriptionEn:`<p>An educational puzzle designed for boys with 6 inspiring shapes that develop thinking and focus skills.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (3 \xd7 18 \xd7 18 cm)</li>
  <li>6 cardboard puzzle boards (15 \xd7 15 cm)</li>
</ul>`,price:160,category:"ألعاب تعليمية",tags:["بازل","أولاد","تعليم"],images:[`${i}/2024/07/Puzzle-Boys-1.webp`,`${i}/2024/07/Puzzle-Boys-2.webp`,`${i}/2024/07/Puzzle-Boys-3.webp`,`${i}/2024/07/Puzzle-Boys-4.webp`],inStock:!0,weight:350,reviews:[{id:"r5-1",author:"نور حسن",rating:5,comment:"بازل جميل وخامات ممتازة. ابني بيلعب بيه كل يوم.",date:"2024-02-08",verified:!0}]},{id:"6",slug:"puzzle-girls",name:"تكوين (بنات)",nameEn:"Formation (Girls)",shortDescription:"بازل بنات — 6 قطع لـ 6 أشكال مختلفة",shortDescriptionEn:"Girls' puzzle — 6 pieces for 6 different shapes",description:`<p>بازل تعليمي مخصص للبنات يحتوي على 6 قطع بأشكال ملهمة تنمي مهارات التفكير والتركيز.</p>
<h3>المحتويات</h3>
<ul>
  <li>علبة من الكرتون المقوى (3 \xd7 18 \xd7 18 سم)</li>
  <li>6 ألواح بازل من الورق المقوى (15 \xd7 15 سم)</li>
</ul>`,descriptionEn:`<p>An educational puzzle designed for girls with 6 inspiring shapes that develop thinking and focus skills.</p>
<h3>Contents</h3>
<ul>
  <li>Heavy cardboard box (3 \xd7 18 \xd7 18 cm)</li>
  <li>6 cardboard puzzle boards (15 \xd7 15 cm)</li>
</ul>`,price:160,category:"ألعاب تعليمية",tags:["بازل","بنات","تعليم"],images:[`${i}/2024/07/Puzzle-Girls-1.webp`,`${i}/2024/07/Puzzle-Girls-2.webp`,`${i}/2024/07/Puzzle-Girls-3.webp`,`${i}/2024/07/Puzzle-Girls-4.webp`],inStock:!0,weight:350,reviews:[{id:"r6-1",author:"دانا محمد",rating:5,comment:"بنتي بتحبه جداً. الألوان جميلة ومناسبة للبنات.",date:"2024-03-12",verified:!0}]},{id:"7",slug:"alwah",name:"ألواح",nameEn:"Writing Boards (Alwah)",shortDescription:"لتعليم وتلقي القرآن الكريم",shortDescriptionEn:"For teaching and learning the Holy Quran",description:`<p>ألواح خشبية مميزة لتعليم الأطفال القرآن الكريم بطريقة مبتكرة وممتعة مع تطبيق مجاني على Google Play.</p>
<h3>المواصفات</h3>
<ul>
  <li>عدد 2 لوح خشب سماكة 8mm</li>
  <li>كرتون 100 غلاف مستور</li>
  <li>طباعة 4 لون وجهين</li>
  <li>سلوفان نبع</li>
  <li>علبة كرتون مقوى (38.5 \xd7 30 سم)</li>
</ul>
<p><strong>التطبيق مجاني على Google Play</strong></p>`,descriptionEn:`<p>Distinctive wooden boards for teaching children the Holy Quran in an innovative and enjoyable way, with a free app on Google Play.</p>
<h3>Specifications</h3>
<ul>
  <li>2 wooden boards, 8mm thick</li>
  <li>100 gsm coated cardboard cover</li>
  <li>4-color double-sided print</li>
  <li>Gloss lamination</li>
  <li>Cardboard box (38.5 \xd7 30 cm)</li>
</ul>
<p><strong>App is free on Google Play</strong></p>`,price:350,category:"أدوات القرآن",tags:["قرآن","تعليم","ألواح"],images:[`${i}/2024/07/Alwah-1.webp`,`${i}/2024/07/Alwah-2.webp`,`${i}/2024/07/Alwah-3.webp`,`${i}/2024/11/Alwah.webp`],inStock:!1,weight:800},{id:"8",slug:"palestine-book",name:"كتاب فلسطين في عيون ابنائي",nameEn:"Palestine Through My Children's Eyes",shortDescription:"كتاب الأسرة عن فلسطين للكبار والصغار",shortDescriptionEn:"A family book about Palestine for young and old",description:`<p>كتاب ثري بالمعلومات والرسوم الجغرافية يُعرّف الأسرة بتاريخ فلسطين من خلال عيون الأبناء، مناسب من سن 10 سنوات.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>193 صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,descriptionEn:`<p>A book rich in information and geographic illustrations, introducing the family to the history of Palestine through children's eyes. Suitable from age 10.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>193 pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,price:220,category:"كتب الأسرة",tags:["فلسطين","كتب","أسرة","تاريخ"],images:[`${i}/2024/07/Palestine-1.webp`,`${i}/2024/07/Palestine-2.webp`,`${i}/2024/07/Palestine-3.webp`,`${i}/2024/11/Palestine-Book.webp`],inStock:!0,weight:285,reviews:[{id:"r8-1",author:"أم يوسف",rating:5,comment:"كتاب رائع وضروري في كل بيت مسلم. المعلومات دقيقة والرسوم جميلة جداً.",date:"2024-03-01",verified:!0},{id:"r8-2",author:"مريم سالم",rating:5,comment:"قرأته مع ابني وانبهر بالمعلومات. كتاب ممتاز يعرف الأطفال بقضية فلسطين.",date:"2024-02-15",verified:!0}]},{id:"9",slug:"to-my-son-book",name:"كتاب إلى ابني واستاذي الشاب",nameEn:"To My Son, My Young Teacher",shortDescription:"كتاب للشباب لمناقشة الشبهات الفكرية",shortDescriptionEn:"A book for youth addressing contemporary intellectual doubts",description:`<p>كتاب مناسب للكبار والصغار من سن 10 سنوات يتناول القضايا الفكرية المعاصرة والشبهات بأسلوب مهذب وراقٍ.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>240+ صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,descriptionEn:`<p>Suitable for ages 10 and above, this book addresses contemporary intellectual issues and doubts in a refined and eloquent style.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>240+ pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,price:180,category:"كتب",tags:["شباب","تربية","فكر","شبهات"],images:[`${i}/2024/07/To-My-Son-1.webp`,`${i}/2024/07/To-My-Son-2.webp`,`${i}/2024/07/To-My-Son-3.webp`,`${i}/2024/07/To-My-Son-4.webp`,`${i}/2024/11/To-my-Son.webp`],inStock:!0,weight:400,reviews:[{id:"r9-1",author:"عمر صالح",rating:5,comment:"كتاب يستحق القراءة. يرد على الشبهات بأسلوب علمي ومنطقي ممتاز.",date:"2024-04-20",verified:!0}]},{id:"10",slug:"mothers-of-greats-book",name:"كتاب رسائل أمهات العظماء",nameEn:"Letters from the Mothers of the Greats",shortDescription:"كتاب تجارب وفوائد عملية للأمهات",shortDescriptionEn:"A book of practical experiences and advice for mothers",description:`<p>كتاب يحتوي على تجارب وقواعد عملية للأمهات يساعدهن على تنشئة أولادهم تنشئة إيمانية ليخرجوا جيلاً مقيماً للصلاة.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>128 صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 2 لون</li>
</ul>`,descriptionEn:`<p>A book containing practical experiences and rules for mothers to help them raise their children in faith, nurturing a generation that establishes prayer.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>128 pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 2-color print</li>
</ul>`,price:180,category:"كتب",tags:["أمهات","تربية","أسرة"],images:[`${i}/2024/07/Mothers-1.webp`,`${i}/2024/07/Mothers-2.webp`,`${i}/2025/09/Mothers-of-Greats.webp`],inStock:!0,videos:["joO3J8S1qkc"],weight:278,reviews:[{id:"r10-1",author:"أم سلمى",rating:5,comment:"كتاب ملهم جداً لكل أم. غير نظرتي لكيفية تربية أطفالي. أنصح به بشدة.",date:"2024-01-25",verified:!0},{id:"r10-2",author:"دعاء محمد",rating:5,comment:"قرأته في يومين من كتر ما هو شيق. معلومات عملية ومفيدة جداً.",date:"2024-02-10",verified:!0}]},{id:"11",slug:"bukhari-on-mars-book",name:"كتاب البخاري على كوكب المريخ",nameEn:"Al-Bukhari on Planet Mars",shortDescription:"كتاب لمناقشة الشبهات بأسلوب قصصي",shortDescriptionEn:"A book addressing doubts through storytelling",description:`<p>كتاب مناسب للكبار والصغار من سن 10 يتناول فهم الحديث والشبهات الفكرية بأسلوب قصصي مشوق بالرسوم الإنفوجرافيك.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>132 صفحة</li>
  <li>داخلي ورق أبيض 70 أو 80 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,descriptionEn:`<p>Suitable for ages 10+, this book addresses hadith comprehension and intellectual doubts through an engaging narrative style with infographic illustrations.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>132 pages</li>
  <li>Interior: 70 or 80 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,price:160,category:"كتب",tags:["حديث","شبهات","قصص","إنفوجرافيك"],images:[`${i}/2024/07/Bukhari-on-Mars-1.webp`,`${i}/2024/07/Bukhari-on-Mars-2.webp`,`${i}/2024/07/Bukhari-on-Mars-3.webp`,`${i}/2024/07/Bukhari-on-Mars-4.webp`,`${i}/2024/11/Bukhari.webp`],inStock:!0,videos:["Vt2gb9bb6Rk"],weight:180,reviews:[{id:"r11-1",author:"يوسف أمين",rating:5,comment:"أسلوب مبتكر جداً في شرح الحديث. الإنفوجرافيك رائع ويسهل الفهم كتير.",date:"2024-03-08",verified:!0}]},{id:"12",slug:"fakih-in-wonderland-book",name:"فقيه في بلاد العجائب",nameEn:"A Jurist in Wonderland",shortDescription:"كتاب فقه الطهارة بأسلوب قصصي مبسط",shortDescriptionEn:"A book on the fiqh of purification in a simplified narrative style",description:`<p>كتاب يتناول باب الطهارة في الفقه بأسلوب قصصي مبسط يجمع بين العلم الشرعي والرواية مع رسوم توضيحية وإنفوجرافيك.</p>
<h3>المواصفات</h3>
<ul>
  <li>غلاف 300 جرام 4 لون</li>
  <li>163 صفحة</li>
  <li>داخلي ورق أبيض 70 جرام</li>
  <li>داخلي طباعة 4 لون</li>
</ul>`,descriptionEn:`<p>A book covering the chapter of purification in Islamic jurisprudence in a simplified narrative style, combining Islamic law with storytelling, illustrations, and infographics.</p>
<h3>Specifications</h3>
<ul>
  <li>300 gsm 4-color cover</li>
  <li>163 pages</li>
  <li>Interior: 70 gsm white paper</li>
  <li>Interior: 4-color print</li>
</ul>`,price:220,category:"كتب",tags:["فقه","طهارة","قصص","أطفال"],images:[`${i}/2024/07/Fakih-in-Wonderland-1.webp`,`${i}/2024/07/Fakih-in-Wonderland-2.webp`,`${i}/2024/07/Fakih-in-Wonderland-3.webp`,`${i}/2024/07/Fakih-in-Wonderland-4.webp`],inStock:!0,videos:["HNpsuHbxyck"],weight:300,reviews:[{id:"r12-1",author:"حسناء طارق",rating:5,comment:"طريقة تعليم الفقه دي مش موجودة في أي كتاب تاني. ابني قرأه بنفسه وفهم.",date:"2024-04-02",verified:!0},{id:"r12-2",author:"إسلام محمد",rating:4,comment:"فكرة ممتازة وتنفيذ جيد. يستحق القراءة.",date:"2024-03-14",verified:!1}]},{id:"13",slug:"pray-story",name:"قصة الصلاة",nameEn:"The Prayer Story",shortDescription:"6 قصص عن الصلاة بتطبيق AR",shortDescriptionEn:"6 stories about prayer with an AR app",description:`<p>6 قصص ممتعة تغرس مفهوم الصلاة وتحقيق العبودية في كل نواحي الحياة مع تطبيق AR مجاني.</p>
<h3>المواصفات</h3>
<ul>
  <li>6 قصص عن الصلاة</li>
  <li>مقاس 24 \xd7 17 سم</li>
  <li>ورق 250 جم</li>
  <li>طباعة 4 لون</li>
</ul>
<p><strong>التطبيق مجاني على Google Play</strong></p>`,descriptionEn:`<p>6 engaging stories that instill the concept of prayer and devotion in every aspect of life, with a free AR app.</p>
<h3>Specifications</h3>
<ul>
  <li>6 stories about prayer</li>
  <li>Size: 24 \xd7 17 cm</li>
  <li>250 gsm paper</li>
  <li>4-color print</li>
</ul>
<p><strong>App is free on Google Play</strong></p>`,price:190,category:"قصص الأطفال",tags:["صلاة","قصص","أطفال","AR"],images:[`${i}/2024/07/Pray-Story-1.webp`,`${i}/2024/07/Pray-Story-2.webp`,`${i}/2024/07/Pray-Story-3.webp`,`${i}/2024/07/Pray-Story-4.webp`],inStock:!0,weight:202,reviews:[{id:"r13-1",author:"آية عبدالرحمن",rating:5,comment:"قصص جميلة جداً وبنتي بتطلب أقراها ليها كل ليلة. الـ AR حاجة تانية!",date:"2024-02-28",verified:!0}]},{id:"14",slug:"my-son-asks-series",name:"سلسلة ابني يسأل",nameEn:"My Son Asks Series",shortDescription:"7 قصص تجاوب على تساؤلات الأطفال",shortDescriptionEn:"7 stories answering children's questions",description:`<p>7 قصص تتناول الأسئلة الشائعة التي تدور في ذهن الأطفال ولا يجدون جواباً عليها بأسلوب مشوق وممتع.</p>
<h3>المواصفات</h3>
<ul>
  <li>7 قصص تساؤلات أطفالنا</li>
  <li>مقاس 24 \xd7 17 سم</li>
  <li>ورق 250 جم</li>
  <li>طباعة 4 لون</li>
</ul>`,descriptionEn:`<p>7 stories addressing common questions that children wonder about but rarely find answers to — presented in an engaging and enjoyable style.</p>
<h3>Specifications</h3>
<ul>
  <li>7 stories on children's questions</li>
  <li>Size: 24 \xd7 17 cm</li>
  <li>250 gsm paper</li>
  <li>4-color print</li>
</ul>`,price:200,category:"قصص الأطفال",tags:["قصص","أطفال","تساؤلات","إيمان"],images:[`${i}/2024/07/My-Son-Asks-1.webp`,`${i}/2024/07/My-Son-Asks-2.webp`,`${i}/2024/07/My-Son-Asks-3.webp`,`${i}/2024/07/My-Son-Asks-4.webp`],inStock:!0,weight:260,reviews:[{id:"r14-1",author:"هبة سمير",rating:5,comment:"سلسلة ممتازة! ابني بيسأل أسئلة كتير وهي بتجاوب عليها بطريقة سهلة ومفهومة.",date:"2024-03-20",verified:!0}]},{id:"15",slug:"righteousness-series",name:"مسلسل البر",nameEn:"The Righteousness Series",shortDescription:"7 قصص لتفهيم البر من الصغر",shortDescriptionEn:"7 stories to teach filial piety from an early age",description:`<p>7 قصص تنمي في الأبناء والآباء قيمة البر وتُمارس الدور التربوي بين الأبناء والآباء، مناسبة من سن 5 إلى 12.</p>
<h3>المواصفات</h3>
<ul>
  <li>7 قصص</li>
  <li>مقاس 23 \xd7 16 سم</li>
  <li>ورق 250 جم</li>
  <li>طباعة 4 لون</li>
</ul>`,descriptionEn:`<p>7 stories that nurture the value of righteousness in both children and parents, serving an educational role between generations. Suitable for ages 5 to 12.</p>
<h3>Specifications</h3>
<ul>
  <li>7 stories</li>
  <li>Size: 23 \xd7 16 cm</li>
  <li>250 gsm paper</li>
  <li>4-color print</li>
</ul>`,price:200,category:"قصص الأطفال",tags:["بر","والدين","قصص","أطفال"],images:[`${i}/2024/07/The-Series-of-Righteousness-1.webp`,`${i}/2024/07/The-Series-of-Righteousness-2.webp`,`${i}/2024/07/The-Series-of-Righteousness-3.webp`,`${i}/2024/07/The-Series-of-Righteousness-4.webp`],inStock:!0,weight:310,reviews:[{id:"r15-1",author:"إيمان خليل",rating:5,comment:"قصص تربوية ممتازة. أحسست إن ابني بقى أكتر احتراماً للكبار بعد ما قرأناها سوا.",date:"2024-04-10",verified:!0}]},{id:"16",slug:"kids-notebook",name:"مفكرة أطفال",nameEn:"Children's Planner",shortDescription:"مفكرة للأطفال (أولاد وبنات) لتنظيم العبادات",shortDescriptionEn:"A planner for children (boys & girls) to organize worship",description:`<p>مفكرة مميزة للأطفال (نموذجين أولاد وبنات) تساعدهم على تنظيم عباداتهم ومهامهم اليومية بطريقة ممتعة.</p>
<h3>المواصفات</h3>
<ul>
  <li>مقاس 24 \xd7 17 سم</li>
  <li>داخلي 120 صفحة 4 لون</li>
  <li>غلاف هارد كوفر 4 لون</li>
  <li>صفحتين ستيكر</li>
  <li>تجليد سلك معدني</li>
</ul>`,descriptionEn:`<p>A special planner for children (two versions: boys and girls) to help them organize their worship and daily tasks in a fun way.</p>
<h3>Specifications</h3>
<ul>
  <li>Size: 24 \xd7 17 cm</li>
  <li>120 interior pages, 4-color</li>
  <li>4-color hardcover</li>
  <li>2 sticker pages</li>
  <li>Metal spiral binding</li>
</ul>`,price:160,category:"مفكرات",tags:["مفكرة","أطفال","تنظيم","عبادات"],images:[`${i}/2024/07/Kids-Notebook-Cover.webp`,`${i}/2024/07/Boys-Notebook-1.webp`,`${i}/2024/07/Boys-Notebook-2.webp`,`${i}/2024/07/Boys-Notebook-3.webp`,`${i}/2024/07/Girls-Notebook-1.webp`,`${i}/2024/07/Girls-Notebook-2.webp`,`${i}/2024/07/Girls-Notebook-3.webp`],inStock:!0,videos:["9kSSCSAg2us"],weight:375,reviews:[{id:"r16-1",author:"سمر علي",rating:5,comment:"مفكرة رائعة! ابني صبح ينظم وقته وعباداته بنفسه من غير ما نذكّره.",date:"2024-01-30",verified:!0},{id:"r16-2",author:"نادية حسن",rating:5,comment:"تصميم جميل وخامة ممتازة. بنتي بتكتب فيها كل يوم.",date:"2024-02-22",verified:!0}]},{id:"17",slug:"adults-notebook",name:"مفكرة كبار",nameEn:"Adults' Planner",shortDescription:"مفكرة للكبار (رجال وسيدات) لتنظيم العبادات",shortDescriptionEn:"A planner for adults (men & women) to organize worship",description:`<p>مفكرة مميزة للكبار (نموذجين رجال وسيدات) تساعد على تنظيم العبادات والمهام اليومية بتصميم أنيق.</p>
<h3>المواصفات</h3>
<ul>
  <li>مقاس A5</li>
  <li>داخلي 120 صفحة 4 لون</li>
  <li>غلاف هارد كوفر 4 لون</li>
  <li>صفحتين ستيكر</li>
  <li>تجليد سلك معدني</li>
</ul>`,descriptionEn:`<p>A special planner for adults (two versions: men and women) to organize worship and daily tasks with an elegant design.</p>
<h3>Specifications</h3>
<ul>
  <li>A5 size</li>
  <li>120 interior pages, 4-color</li>
  <li>4-color hardcover</li>
  <li>2 sticker pages</li>
  <li>Metal spiral binding</li>
</ul>`,price:160,category:"مفكرات",tags:["مفكرة","كبار","تنظيم","عبادات"],images:[`${i}/2024/07/Adults-Notebook-Cover.webp`,`${i}/2024/07/Men-Notebook-1.webp`,`${i}/2024/07/Men-Notebook-2.webp`,`${i}/2024/07/Men-Notebook-3.webp`,`${i}/2024/07/Women-Notebook-1.webp`,`${i}/2024/07/Women-Notebook-2.webp`,`${i}/2024/07/Women-Notebook-3.webp`],inStock:!0,videos:["9kSSCSAg2us"],weight:273,reviews:[{id:"r17-1",author:"خالد رضا",rating:5,comment:"مفكرة ممتازة لتنظيم العبادات اليومية. التصميم أنيق ومحفز على الاستمرار.",date:"2024-03-05",verified:!0}]},{id:"18",slug:"ml-bag",name:"شنطة مسلم ليدر",nameEn:"Moslim Leader Bag",shortDescription:"شنطة مدرسية للحضانة KG1–KG2 بتصاميم إسلامية",shortDescriptionEn:"A school bag for kindergarten KG1–KG2 with Islamic designs",description:`<p>شنطة مسلم ليدر برسومات مناسبة لهويتنا وثقافتنا، بعيداً عن أوهام الشخصيات الدخيلة. متوفرة نموذجين أولاد وبنات.</p>
<h3>المواصفات</h3>
<ul>
  <li>شنطة للحضانة KG1 – KG2</li>
  <li>خامة بولي ايستر ثقيل</li>
  <li>طباعة 4 لون سليميدش</li>
  <li>سوستتان كبيرتان وجيب أمامي</li>
  <li>33 \xd7 28 \xd7 12 سم</li>
</ul>`,descriptionEn:`<p>Moslim Leader bag with designs true to our identity and culture — free from foreign cartoon characters. Available in two versions: boys and girls.</p>
<h3>Specifications</h3>
<ul>
  <li>Kindergarten bag for KG1 – KG2</li>
  <li>Heavy polyester material</li>
  <li>4-color sublimation print</li>
  <li>2 large zippers and front pocket</li>
  <li>33 \xd7 28 \xd7 12 cm</li>
</ul>`,price:280,category:"إكسسوار",tags:["شنطة","أطفال","مدرسة","حضانة"],images:[`${i}/2024/10/Boys-Bag-1-1.webp`,`${i}/2024/10/Boys-Bag-1-2.webp`,`${i}/2024/10/Girls-Bag-1.webp`,`${i}/2024/10/Girls-Bag-2.webp`],inStock:!1,weight:400},{id:"19",slug:"masek",name:"ماسك (حامل المصحف)",nameEn:"Masek (Quran Holder)",shortDescription:"حامل مصحف للأطفال لتشجيعهم على التلاوة",shortDescriptionEn:"A Quran holder for children to encourage recitation",description:`<p>حامل مصحف للأطفال يشجعهم على تلاوة القرآن، متوفر بـ 4 ألوان مختلفة (أصفر وأخضر وردي وأزرق) مع تطبيق مجاني.</p>
<h3>المواصفات</h3>
<ul>
  <li>عدد 2 لوح خشب سماكة 8mm</li>
  <li>مقاس اللوح الواحد A4 تقريباً</li>
  <li>مكسي من الوجهين</li>
  <li>طباعة 4 لون للوجهين</li>
</ul>
<p><strong>التطبيق مجاني على Google Play</strong></p>`,descriptionEn:`<p>A Quran holder for children that encourages them to recite the Holy Quran. Available in 4 colors (yellow, green, pink, and blue) with a free app.</p>
<h3>Specifications</h3>
<ul>
  <li>2 wooden boards, 8mm thick</li>
  <li>Each board approximately A4 size</li>
  <li>Laminated on both sides</li>
  <li>4-color print on both sides</li>
</ul>
<p><strong>App is free on Google Play</strong></p>`,price:190,category:"أدوات القرآن",tags:["قرآن","حامل","مصحف","أطفال"],images:[`${i}/2024/10/Masek-Cover.webp`,`${i}/2024/10/Masek-1.webp`,`${i}/2024/10/Masek-2.webp`,`${i}/2024/10/Masek-3.webp`,`${i}/2024/10/Masek-4.webp`],inStock:!0,weight:450,reviews:[{id:"r19-1",author:"أم زياد",rating:5,comment:"فكرة جميلة جداً. ابني صبح يحب يقرأ القرآن وهو مستني دوره على الماسك!",date:"2024-04-25",verified:!0}]},{id:"20",slug:"boys-mug",name:"مجات ولاد",nameEn:"Boys' Mugs",shortDescription:"مج هدية بهوية إسلامية للأولاد",shortDescriptionEn:"A gift mug with Islamic identity for boys",description:`<p>مج هدية جذابة تحمل هوية إسلامية تناسب الجميع، بتصاميم للأولاد مستوحاة من الشخصية المسلمة الفاعلة.</p>
<h3>المواصفات</h3>
<ul>
  <li>ملون من الداخل بلون اليد</li>
  <li>الوزن: 320 جرام</li>
  <li>ارتفاع 10 سم – قطر 8 سم</li>
  <li>السعة: 300 مل</li>
  <li>يمكن كتابة اسم بالطلب</li>
  <li>خامة فاخرة قابلة للغسل في غسالة</li>
</ul>`,descriptionEn:`<p>An attractive gift mug with an Islamic identity, with designs for boys inspired by the active Muslim character.</p>
<h3>Specifications</h3>
<ul>
  <li>Colored interior matching the handle</li>
  <li>Weight: 320 grams</li>
  <li>Height: 10 cm – Diameter: 8 cm</li>
  <li>Capacity: 300 ml</li>
  <li>Name can be added upon request</li>
  <li>Premium dishwasher-safe material</li>
</ul>`,price:170,category:"مجات",tags:["مج","هدية","أولاد","إسلامي"],images:[`${i}/2024/10/Boys-Mugs-1.webp`,`${i}/2024/10/Boys-Mug-1.webp`,`${i}/2024/10/Boys-Mug-2.webp`,`${i}/2024/10/Boys-Mug-3.webp`,`${i}/2024/10/Boys-Mug-4.webp`,`${i}/2024/10/Boys-Mug-5.webp`,`${i}/2024/10/Boys-Mug-6.webp`],inStock:!0,weight:350,reviews:[{id:"r20-1",author:"محمد السيد",rating:5,comment:"مج حلو جداً وخامة ممتازة. أهدى لابني وبيستخدمه كل يوم.",date:"2024-02-05",verified:!0},{id:"r20-2",author:"شيماء أحمد",rating:4,comment:"هدية مثالية. التصميم الإسلامي مميز ومختلف.",date:"2024-01-18",verified:!1}]},{id:"21",slug:"girls-mug",name:"مجات بنات",nameEn:"Girls' Mugs",shortDescription:"مج هدية بهوية إسلامية للبنات",shortDescriptionEn:"A gift mug with Islamic identity for girls",description:`<p>مج هدية جذابة تحمل هوية إسلامية تناسب الجميع، بتصاميم للبنات مستوحاة من الشخصية المسلمة المتميزة.</p>
<h3>المواصفات</h3>
<ul>
  <li>ملون من الداخل بلون اليد</li>
  <li>الوزن: 320 جرام</li>
  <li>ارتفاع 10 سم – قطر 8 سم</li>
  <li>السعة: 300 مل</li>
  <li>يمكن كتابة اسم بالطلب</li>
  <li>خامة فاخرة قابلة للغسل في غسالة</li>
</ul>`,descriptionEn:`<p>An attractive gift mug with an Islamic identity, with designs for girls inspired by the distinguished Muslim character.</p>
<h3>Specifications</h3>
<ul>
  <li>Colored interior matching the handle</li>
  <li>Weight: 320 grams</li>
  <li>Height: 10 cm – Diameter: 8 cm</li>
  <li>Capacity: 300 ml</li>
  <li>Name can be added upon request</li>
  <li>Premium dishwasher-safe material</li>
</ul>`,price:170,category:"مجات",tags:["مج","هدية","بنات","إسلامي"],images:[`${i}/2024/10/Girls-Mugs.webp`,`${i}/2024/10/Girls-Mug-1.webp`,`${i}/2024/10/Girls-Mug-2.webp`,`${i}/2024/10/Girls-Mug-3.webp`,`${i}/2024/10/Girls-Mug-4.webp`,`${i}/2024/10/Girls-Mug-5.webp`,`${i}/2024/10/Girls-Mug-6.webp`],inStock:!0,weight:350,reviews:[{id:"r21-1",author:"لمى حسام",rating:5,comment:"مج بنات تصميمه جميل ويعكس هويتنا الإسلامية. شكراً مسلم ليدر!",date:"2024-03-28",verified:!0}]},{id:"22",slug:"women-mug",name:"مجات نساء",nameEn:"Women's Mugs",shortDescription:"مج هدية بهوية إسلامية للنساء",shortDescriptionEn:"A gift mug with Islamic identity for women",description:`<p>مج هدية جذابة تحمل هوية إسلامية تناسب الجميع، بتصاميم للنساء تعكس جمال الهوية الإسلامية.</p>
<h3>المواصفات</h3>
<ul>
  <li>ملون من الداخل بلون اليد</li>
  <li>الوزن: 320 جرام</li>
  <li>ارتفاع 10 سم – قطر 8 سم</li>
  <li>السعة: 300 مل</li>
  <li>يمكن كتابة اسم بالطلب</li>
  <li>خامة فاخرة قابلة للغسل في غسالة</li>
</ul>`,descriptionEn:`<p>An attractive gift mug with an Islamic identity, with designs for women reflecting the beauty of Islamic identity.</p>
<h3>Specifications</h3>
<ul>
  <li>Colored interior matching the handle</li>
  <li>Weight: 320 grams</li>
  <li>Height: 10 cm – Diameter: 8 cm</li>
  <li>Capacity: 300 ml</li>
  <li>Name can be added upon request</li>
  <li>Premium dishwasher-safe material</li>
</ul>`,price:170,category:"مجات",tags:["مج","هدية","نساء","إسلامي"],images:[`${i}/2024/10/Women-Mugs.webp`,`${i}/2024/10/Women-Mugs-1.webp`,`${i}/2024/10/Women-Mugs-2.webp`,`${i}/2024/10/Women-Mugs-3.webp`,`${i}/2024/10/Women-Mugs-4.webp`,`${i}/2024/10/Women-Mugs-5.webp`],inStock:!0,weight:350,reviews:[{id:"r22-1",author:"نوران إبراهيم",rating:5,comment:"هدية راقية وجميلة. التصميم الإسلامي يميزه عن أي مج تاني.",date:"2024-04-14",verified:!0}]},{id:"23",slug:"ml-pin",name:"دبوس",nameEn:"Moslim Leader Pin",shortDescription:"دبوس مسلم ليدر بتصاميم متنوعة",shortDescriptionEn:"Moslim Leader pin with various designs",description:`<p>دبوس مسلم ليدر بتصاميم جذابة ومتنوعة تعبر عن الهوية الإسلامية، خامة بلاستيك عالية الجودة.</p>
<h3>المواصفات</h3>
<ul>
  <li>خامة بلاستيك</li>
  <li>قطر 4.5 سم</li>
  <li>الوزن: 6 جرام</li>
</ul>`,descriptionEn:`<p>A Moslim Leader pin with attractive and diverse designs expressing Islamic identity, made from high-quality plastic.</p>
<h3>Specifications</h3>
<ul>
  <li>Plastic material</li>
  <li>Diameter: 4.5 cm</li>
  <li>Weight: 6 grams</li>
</ul>`,price:35,category:"إكسسوار",tags:["دبوس","هدية","إكسسوار"],images:[`${i}/2024/10/Pins.webp`,`${i}/2024/10/Black-Pin.webp`,`${i}/2024/10/White-Pin.webp`,`${i}/2024/10/Yellow-Pin.webp`,`${i}/2024/10/Boys-Pin-1.webp`,`${i}/2024/10/Girls-Pin.webp`],inStock:!1,weight:20}],r=[{id:"all",name:"الكل",count:t.length},{id:"ألعاب تعليمية",name:"ألعاب تعليمية",count:t.filter(e=>"ألعاب تعليمية"===e.category).length},{id:"كتب",name:"كتب",count:t.filter(e=>"كتب"===e.category).length},{id:"كتب الأسرة",name:"كتب الأسرة",count:t.filter(e=>"كتب الأسرة"===e.category).length},{id:"قصص الأطفال",name:"قصص الأطفال",count:t.filter(e=>"قصص الأطفال"===e.category).length},{id:"أدوات القرآن",name:"أدوات القرآن",count:t.filter(e=>"أدوات القرآن"===e.category).length},{id:"مفكرات",name:"مفكرات",count:t.filter(e=>"مفكرات"===e.category).length},{id:"إكسسوار",name:"إكسسوار",count:t.filter(e=>"إكسسوار"===e.category).length},{id:"مجات",name:"مجات",count:t.filter(e=>"مجات"===e.category).length}];e.s(["categories",0,r,"products",0,t])},76289,e=>{"use strict";var i=e.i(43476),t=e.i(71645),r=e.i(70820),a=e.i(65721);let l={"ألعاب تعليمية":["ألعاب لوحية","ألعاب تفاعلية","ألعاب تركيب","ألعاب كروت"],كتب:["كتب أطفال","كتب إسلامية","كتب تعليمية","كتب مغامرات"],"كتب الأسرة":["كتب تربية","كتب أمومة","تنمية ذاتية"],"قصص الأطفال":["قصص دينية","قصص تعليمية","قصص مغامرات"],"أدوات القرآن":["حاملات مصحف","أدوات قراءة","مستلزمات"],مفكرات:["مفكرات أطفال","مفكرات كبار","أجندات"],إكسسوار:["دبابيس","شنط","مفاتيح","هدايا"],مجات:["مجات أطفال","مجات كبار","مجات نسائية"]};function n(e){return new Promise((i,t)=>{let r=new FileReader;r.onload=()=>i(r.result),r.onerror=t,r.readAsDataURL(e)})}let s={slug:"",name:"",nameEn:"",shortDescription:"",shortDescriptionEn:"",description:"",descriptionEn:"",price:0,category:"",subcategory:"",tags:[],images:[],inStock:!0,featured:!1,weight:0};function o(){let[e,o]=(0,t.useState)({}),[d,c]=(0,t.useState)([]),[p,g]=(0,t.useState)(null),[h,m]=(0,t.useState)(""),[u,b]=(0,t.useState)(!1),[x,y]=(0,t.useState)(s),[f,w]=(0,t.useState)(""),[v,j]=(0,t.useState)([]),[k,N]=(0,t.useState)([]),[S,E]=(0,t.useState)(!1),[$,A]=(0,t.useState)(!1),M=(0,t.useRef)(null),P=(0,t.useCallback)(()=>{o((0,r.getProductOverrides)()),c((0,r.getAddedProducts)())},[]);(0,t.useEffect)(()=>{P()},[P]);let D=[...a.products.map(i=>({...i,price:e[i.id]?.price??i.price,inStock:e[i.id]?.inStock??i.inStock,featured:e[i.id]?.featured??i.featured})),...d.map(e=>({...e,isAdded:!0}))],C=async e=>{let i=Array.from(e).filter(e=>e.type.startsWith("image/"));if(!i.length)return;let t=await Promise.all(i.map(n));j(e=>[...e,...t].slice(0,8))},z=async e=>{e.preventDefault(),E(!1),await C(e.dataTransfer.files)},I=async e=>{e.target.files&&await C(e.target.files),e.target.value=""},G=(e,i)=>{j(t=>{let r=[...t],[a]=r.splice(e,1);return r.splice(i,0,a),r})},B=e=>{let i=parseFloat(h);if(isNaN(i)||i<=0)return void g(null);if(e.isAdded){let t=d.map(t=>t.id===e.id?{...t,price:i}:t);c(t),(0,r.saveAddedProducts)(t)}else(0,r.setProductOverride)(e.id,{price:i}),P();g(null)},O=(e,i)=>{N(t=>t.map(t=>t.id===e?{...t,...i}:t))},L=()=>{y(s),w(""),j([]),N([]),b(!1)},F=a.categories.filter(e=>"all"!==e.id).map(e=>e.name),H=x.category?l[x.category]??[]:[];return(0,i.jsxs)("div",{className:"space-y-5",children:[(0,i.jsxs)("div",{className:"flex items-center justify-between",children:[(0,i.jsxs)("div",{children:[(0,i.jsx)("h1",{className:"text-xl font-black text-gray-900",children:"المنتجات"}),(0,i.jsxs)("p",{className:"text-sm text-gray-500 mt-0.5",children:[D.length," منتج"]})]}),!u&&(0,i.jsxs)("button",{onClick:()=>b(!0),className:"bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-bold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2",children:[(0,i.jsx)("span",{children:"+"})," إضافة منتج"]})]}),u&&(0,i.jsxs)("div",{className:"bg-white border border-gray-200 rounded-2xl p-6 space-y-5",children:[(0,i.jsxs)("div",{className:"flex items-center justify-between",children:[(0,i.jsx)("h2",{className:"font-bold text-gray-900 text-base",children:"إضافة منتج جديد"}),(0,i.jsx)("button",{onClick:L,className:"text-gray-400 hover:text-gray-600 text-xl leading-none",children:"✕"})]}),(0,i.jsxs)("div",{children:[(0,i.jsxs)("label",{className:"block text-xs font-semibold text-gray-600 mb-2",children:["الصور * ",(0,i.jsx)("span",{className:"text-gray-400 font-normal",children:"(حتى 8 صور — الأولى هي الرئيسية)"})]}),(0,i.jsxs)("div",{onDragOver:e=>{e.preventDefault(),E(!0)},onDragLeave:()=>E(!1),onDrop:z,onClick:()=>M.current?.click(),className:`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition select-none ${S?"border-[#F5C518] bg-amber-50":"border-gray-200 hover:border-gray-400 hover:bg-gray-50"}`,children:[(0,i.jsx)("div",{className:"text-3xl mb-2",children:"🖼️"}),(0,i.jsx)("p",{className:"font-semibold text-gray-700 text-sm",children:"اسحب الصور هنا أو اضغط للاختيار"}),(0,i.jsx)("p",{className:"text-xs text-gray-400 mt-1",children:"PNG، JPG، WEBP — حتى 8 صور"}),(0,i.jsx)("input",{ref:M,type:"file",accept:"image/*",multiple:!0,className:"hidden",onChange:I})]}),v.length>0&&(0,i.jsxs)("div",{className:"mt-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2",children:[v.map((e,t)=>(0,i.jsxs)("div",{className:"relative group aspect-square",children:[(0,i.jsx)("img",{src:e,alt:`صورة ${t+1}`,className:"w-full h-full object-cover rounded-xl border border-gray-200"}),(0,i.jsx)("span",{className:"absolute top-1 right-1 bg-black/60 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center",children:t+1}),(0,i.jsxs)("div",{className:"absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1",children:[t>0&&(0,i.jsx)("button",{onClick:e=>{e.stopPropagation(),G(t,t-1)},className:"w-6 h-6 bg-white/90 rounded-full text-xs font-bold text-gray-800 hover:bg-white",title:"تقديم",children:"›"}),(0,i.jsx)("button",{onClick:e=>{e.stopPropagation(),j(e=>e.filter((e,i)=>i!==t))},className:"w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold hover:bg-red-600",title:"حذف",children:"✕"}),t<v.length-1&&(0,i.jsx)("button",{onClick:e=>{e.stopPropagation(),G(t,t+1)},className:"w-6 h-6 bg-white/90 rounded-full text-xs font-bold text-gray-800 hover:bg-white",title:"تأخير",children:"‹"})]}),0===t&&(0,i.jsx)("span",{className:"absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white bg-[#F5C518]/90 py-0.5",children:"رئيسية"})]},t)),v.length<8&&(0,i.jsx)("button",{onClick:()=>M.current?.click(),className:"aspect-square border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition text-2xl",children:"+"})]})]}),v.length>0&&(0,i.jsxs)("div",{children:[(0,i.jsxs)("div",{className:"flex items-center justify-between mb-3",children:[(0,i.jsx)("div",{children:(0,i.jsxs)("label",{className:"block text-xs font-semibold text-gray-600",children:["الموديلات / الألوان",(0,i.jsx)("span",{className:"text-gray-400 font-normal mr-1",children:"(اختياري — لو المنتج له أشكال مختلفة)"})]})}),(0,i.jsx)("button",{type:"button",onClick:()=>{N(e=>[...e,{id:`v-${Date.now()}`,name:"",nameEn:"",imageIndex:-1}])},className:"text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1",children:"+ إضافة موديل"})]}),k.length>0&&(0,i.jsx)("div",{className:"space-y-3",children:k.map((e,t)=>(0,i.jsxs)("div",{className:"border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2",children:[(0,i.jsxs)("div",{className:"flex items-center gap-2",children:[(0,i.jsxs)("span",{className:"text-xs font-bold text-gray-500 w-16 shrink-0",children:["موديل ",t+1]}),(0,i.jsx)("input",{value:e.name,onChange:i=>O(e.id,{name:i.target.value}),placeholder:"الاسم (عربي) — مثلاً: أحمر، كبير، A",className:"flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white"}),(0,i.jsx)("input",{value:e.nameEn,onChange:i=>O(e.id,{nameEn:i.target.value}),placeholder:"English name (optional)",className:"flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white",dir:"ltr"}),(0,i.jsx)("button",{onClick:()=>{var i;return i=e.id,void N(e=>e.filter(e=>e.id!==i))},className:"text-red-400 hover:text-red-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition text-sm",children:"✕"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("p",{className:"text-xs text-gray-500 mb-1.5",children:"اختر صورة هذا الموديل:"}),(0,i.jsx)("div",{className:"flex gap-2 flex-wrap",children:v.map((t,r)=>(0,i.jsxs)("button",{type:"button",onClick:()=>O(e.id,{imageIndex:r}),className:`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition ${e.imageIndex===r?"border-purple-500 ring-2 ring-purple-300":"border-gray-200 hover:border-gray-400"}`,children:[(0,i.jsx)("img",{src:t,alt:"",className:"w-full h-full object-cover"}),e.imageIndex===r&&(0,i.jsx)("div",{className:"absolute inset-0 bg-purple-500/20 flex items-center justify-center",children:(0,i.jsx)("span",{className:"text-white text-sm font-black",children:"✓"})})]},r))}),e.imageIndex<0&&(0,i.jsx)("p",{className:"text-amber-600 text-xs mt-1",children:"* اختر صورة للموديل"})]})]},e.id))}),0===k.length&&(0,i.jsx)("p",{className:"text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3 text-center",children:'لو المنتج منه ألوان أو أشكال مختلفة — اضغط "إضافة موديل" وحدد اسم وصورة كل موديل'})]}),(0,i.jsxs)("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الاسم (عربي) *"}),(0,i.jsx)("input",{value:x.name,onChange:e=>{let i=e.target.value;y(e=>({...e,name:i,slug:e.slug||(e.nameEn,"")}))},className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الاسم (إنجليزي)"}),(0,i.jsx)("input",{value:x.nameEn||"",onChange:e=>{let i=e.target.value;y(e=>({...e,nameEn:i,slug:""===e.slug?i.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""):e.slug}))},className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400",dir:"ltr"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"Slug (للرابط) *"}),(0,i.jsx)("input",{value:x.slug,onChange:e=>y(i=>({...i,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,"-")})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 font-mono",dir:"ltr",placeholder:"product-name"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الفئة الرئيسية *"}),(0,i.jsxs)("select",{value:x.category,onChange:e=>y(i=>({...i,category:e.target.value,subcategory:""})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white",children:[(0,i.jsx)("option",{value:"",children:"— اختر فئة —"}),F.map(e=>(0,i.jsx)("option",{value:e,children:e},e))]})]}),x.category&&(0,i.jsxs)("div",{children:[(0,i.jsxs)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:["الفئة الفرعية",(0,i.jsx)("span",{className:"text-gray-400 font-normal mr-1",children:"(اختياري)"})]}),H.length>0?(0,i.jsxs)("select",{value:x.subcategory||"",onChange:e=>y(i=>({...i,subcategory:e.target.value})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 bg-white",children:[(0,i.jsx)("option",{value:"",children:"— بدون فئة فرعية —"}),H.map(e=>(0,i.jsx)("option",{value:e,children:e},e))]}):(0,i.jsx)("input",{value:x.subcategory||"",onChange:e=>y(i=>({...i,subcategory:e.target.value})),placeholder:"اكتب الفئة الفرعية...",className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"السعر (EGP) *"}),(0,i.jsx)("input",{type:"number",value:x.price||"",onChange:e=>y(i=>({...i,price:+e.target.value})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400",min:"0"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الوزن (جرام) — للشحن الدولي"}),(0,i.jsx)("input",{type:"number",value:x.weight||"",onChange:e=>y(i=>({...i,weight:+e.target.value})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400",min:"0"})]}),(0,i.jsxs)("div",{className:"sm:col-span-2",children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الوصف المختصر (عربي)"}),(0,i.jsx)("input",{value:x.shortDescription,onChange:e=>y(i=>({...i,shortDescription:e.target.value})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"})]}),(0,i.jsxs)("div",{className:"sm:col-span-2",children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الوصف المختصر (إنجليزي)"}),(0,i.jsx)("input",{value:x.shortDescriptionEn||"",onChange:e=>y(i=>({...i,shortDescriptionEn:e.target.value})),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400",dir:"ltr"})]}),(0,i.jsxs)("div",{className:"sm:col-span-2",children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"الوصف الكامل (عربي — HTML مسموح)"}),(0,i.jsx)("textarea",{value:x.description,onChange:e=>y(i=>({...i,description:e.target.value})),rows:4,className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400 resize-none"})]}),(0,i.jsxs)("div",{children:[(0,i.jsx)("label",{className:"block text-xs font-semibold text-gray-600 mb-1",children:"Tags (مفصولة بفاصلة)"}),(0,i.jsx)("input",{value:f,onChange:e=>w(e.target.value),className:"w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400",placeholder:"لعبة, أطفال, تعليمي"})]}),(0,i.jsxs)("div",{className:"flex items-center gap-6 pt-2",children:[(0,i.jsxs)("label",{className:"flex items-center gap-2 cursor-pointer",children:[(0,i.jsx)("input",{type:"checkbox",checked:x.inStock,onChange:e=>y(i=>({...i,inStock:e.target.checked})),className:"w-4 h-4 accent-[#F5C518]"}),(0,i.jsx)("span",{className:"text-sm font-semibold text-gray-700",children:"متوفر في المخزن"})]}),(0,i.jsxs)("label",{className:"flex items-center gap-2 cursor-pointer",children:[(0,i.jsx)("input",{type:"checkbox",checked:x.featured||!1,onChange:e=>y(i=>({...i,featured:e.target.checked})),className:"w-4 h-4 accent-[#F5C518]"}),(0,i.jsx)("span",{className:"text-sm font-semibold text-gray-700",children:"منتج مميز ⭐"})]})]})]}),(0,i.jsxs)("div",{className:"flex gap-3 pt-1 border-t border-gray-100",children:[(0,i.jsx)("button",{onClick:()=>{if(!x.name||!x.slug||!x.price||!x.category)return void alert("يرجى ملء الحقول المطلوبة: الاسم، الـ Slug، السعر، الفئة");if(0===v.length)return void alert("يرجى إضافة صورة واحدة على الأقل");A(!0);let e=k.filter(e=>e.name&&e.imageIndex>=0).map(e=>({id:e.id,name:e.name,nameEn:e.nameEn||void 0,imageIndex:e.imageIndex})),i={...x,id:`added-${Date.now()}`,tags:f.split(",").map(e=>e.trim()).filter(Boolean),images:v,variants:e.length>0?e:void 0,reviews:[]};(0,r.addProduct)(i),L(),A(!1),P()},disabled:$,className:"bg-[#1a1a2e] text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-[#2a2a4e] transition disabled:opacity-50 flex items-center gap-2",children:$?(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)("span",{className:"w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"})," جارٍ الحفظ..."]}):(0,i.jsx)(i.Fragment,{children:"'💾 حفظ المنتج"})}),(0,i.jsx)("button",{onClick:L,className:"border border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition",children:"إلغاء"})]})]}),(0,i.jsx)("div",{className:"bg-white rounded-2xl border border-gray-200 overflow-hidden",children:(0,i.jsx)("div",{className:"overflow-x-auto",children:(0,i.jsxs)("table",{className:"w-full text-sm",children:[(0,i.jsx)("thead",{className:"bg-gray-50 border-b border-gray-100",children:(0,i.jsxs)("tr",{className:"text-xs text-gray-500 font-semibold",children:[(0,i.jsx)("th",{className:"px-4 py-3.5 text-right",children:"المنتج"}),(0,i.jsx)("th",{className:"px-4 py-3.5 text-right",children:"الفئة"}),(0,i.jsx)("th",{className:"px-4 py-3.5 text-right",children:"السعر"}),(0,i.jsx)("th",{className:"px-4 py-3.5 text-center",children:"المخزون"}),(0,i.jsx)("th",{className:"px-4 py-3.5 text-center",children:"مميز"}),(0,i.jsx)("th",{className:"px-4 py-3.5 text-center",children:"إجراءات"})]})}),(0,i.jsx)("tbody",{className:"divide-y divide-gray-50",children:D.map(e=>(0,i.jsxs)("tr",{className:"hover:bg-gray-50 transition",children:[(0,i.jsx)("td",{className:"px-4 py-3",children:(0,i.jsxs)("div",{className:"flex items-center gap-3",children:[(0,i.jsx)("div",{className:"w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0",children:e.images[0]&&(0,i.jsx)("img",{src:e.images[0],alt:e.name,className:"w-full h-full object-cover"})}),(0,i.jsxs)("div",{children:[(0,i.jsx)("p",{className:"font-semibold text-gray-900 text-xs leading-tight",children:e.name}),e.nameEn&&(0,i.jsx)("p",{className:"text-gray-400 text-xs",children:e.nameEn}),e.subcategory&&(0,i.jsx)("p",{className:"text-purple-400 text-xs",children:e.subcategory}),e.isAdded&&(0,i.jsx)("span",{className:"text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold",children:"مضاف"})]})]})}),(0,i.jsx)("td",{className:"px-4 py-3 text-gray-500 text-xs",children:e.category}),(0,i.jsx)("td",{className:"px-4 py-3",children:p===e.id?(0,i.jsxs)("div",{className:"flex items-center gap-1.5",children:[(0,i.jsx)("input",{type:"number",value:h,onChange:e=>m(e.target.value),onKeyDown:i=>{"Enter"===i.key&&B(e),"Escape"===i.key&&g(null)},autoFocus:!0,className:"w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F5C518]"}),(0,i.jsx)("button",{onClick:()=>B(e),className:"text-green-600 hover:text-green-700 font-bold text-xs",children:"✓"}),(0,i.jsx)("button",{onClick:()=>g(null),className:"text-gray-400 hover:text-gray-600 text-xs",children:"✕"})]}):(0,i.jsxs)("button",{onClick:()=>{g(e.id),m(e.price.toString())},className:"font-bold text-gray-900 hover:text-[#1a1a2e] hover:underline text-xs",children:[e.price.toLocaleString("ar-EG")," ج"]})}),(0,i.jsx)("td",{className:"px-4 py-3 text-center",children:(0,i.jsx)("button",{onClick:()=>(e=>{if(e.isAdded){let i=d.map(i=>i.id===e.id?{...i,inStock:!i.inStock}:i);c(i),(0,r.saveAddedProducts)(i)}else(0,r.setProductOverride)(e.id,{inStock:!e.inStock}),P()})(e),className:`px-2.5 py-1 rounded-full text-xs font-bold transition ${e.inStock?"bg-green-100 text-green-700 hover:bg-green-200":"bg-red-100 text-red-600 hover:bg-red-200"}`,children:e.inStock?"متوفر":"نفذ"})}),(0,i.jsx)("td",{className:"px-4 py-3 text-center",children:(0,i.jsx)("button",{onClick:()=>(e=>{if(e.isAdded){let i=d.map(i=>i.id===e.id?{...i,featured:!i.featured}:i);c(i),(0,r.saveAddedProducts)(i)}else(0,r.setProductOverride)(e.id,{featured:!e.featured}),P()})(e),className:`text-lg transition hover:scale-125 ${e.featured?"opacity-100":"opacity-25"}`,children:"⭐"})}),(0,i.jsx)("td",{className:"px-4 py-3 text-center",children:e.isAdded&&(0,i.jsx)("button",{onClick:()=>{!e.isAdded||confirm(`حذف "${e.name}"؟`)&&((0,r.deleteAddedProduct)(e.id),P())},className:"text-red-400 hover:text-red-600 text-xs font-bold transition",children:"حذف"})})]},e.id))})]})})})]})}e.s(["default",()=>o])}]);