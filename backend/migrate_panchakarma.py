"""
Migration & Seeding Script:
1. Adds category, dosha_target, and indications columns to therapies table.
2. Seeds the complete classical Panchakarma suite (Pradhana Karma, Poorva Karma, Paschat Karma, Upakarma).
3. Authorizes therapists for all therapies.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from decimal import Decimal
from sqlalchemy import text
from app.db.session import engine, SessionLocal
from app.models import Therapy, Staff, TherapistTherapy, Room

def run():
    print("Migrating therapies table schema...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE therapies ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'upakarma';"))
        conn.execute(text("ALTER TABLE therapies ADD COLUMN IF NOT EXISTS dosha_target VARCHAR(100);"))
        conn.execute(text("ALTER TABLE therapies ADD COLUMN IF NOT EXISTS indications TEXT;"))
        conn.commit()
    print("Schema updated successfully!")

    db = SessionLocal()
    try:
        panchakarma_suite = [
            # ---------------------------------------------------------
            # 1. PRADHANA KARMA (THE 5 CORE CLASSICAL PANCHAKARMAS)
            # ---------------------------------------------------------
            {
                "name": "Vamana Karma (Therapeutic Emesis)",
                "category": "pradhana_karma",
                "dosha_target": "Kapha Dosha & Ama",
                "indications": "Asthma, Chronic Bronchitis, Psoriasis, Eczema, Hyperacidity, Obesity, Kapha toxins",
                "description": "Classical therapeutic emesis procedure for complete elimination of deep-seated vitiated Kapha and metabolic toxins (Ama) from the upper gastrointestinal tract.",
                "duration": 120,
                "price": Decimal("3500.00"),
                "facilities": "table,vamana_chamber,emesis_bowl,hot_water",
            },
            {
                "name": "Virechana Karma (Therapeutic Purgation)",
                "category": "pradhana_karma",
                "dosha_target": "Pitta Dosha & Rakta Dhatu",
                "indications": "Chronic Skin Disorders, Psoriasis, Dermatitis, Jaundice, Liver dysfunction, Gout, Chronic Fever",
                "description": "Classical controlled purgation procedure eliminating morbid Pitta dosha and purifying blood from the liver, gall bladder, and small intestines.",
                "duration": 180,
                "price": Decimal("3200.00"),
                "facilities": "table,rest_room,monitoring_equipment",
            },
            {
                "name": "Niruha / Kashaya Basti (Medicated Decoction Enema)",
                "category": "pradhana_karma",
                "dosha_target": "Vata Dosha (Ardha Chikitsa)",
                "indications": "Rheumatoid Arthritis, Sciatica, Hemiplegia, Chronic Constipation, Lumbar Spondylosis, Neurological conditions",
                "description": "Primary Vata-cleansing treatment using warm medicated herbal decoctions, honey, saindhava salt, and herbal paste to cleanse the colon and systemic micro-channels.",
                "duration": 75,
                "price": Decimal("2200.00"),
                "facilities": "table,basti_equipment,warm_bath",
            },
            {
                "name": "Anuvasana / Sneha Basti (Medicated Oil Enema)",
                "category": "pradhana_karma",
                "dosha_target": "Vata Dosha & Dhatu Nourishment",
                "indications": "Osteoarthritis, Neuromuscular atrophy, Chronic Fatigue, Dryness, Insomnia, Spinal stiffness",
                "description": "Nourishing and lubricating enema using warm medicated taila (oil) or ghrita to calm Vata, lubricate tissues, and restore structural vitality.",
                "duration": 45,
                "price": Decimal("1600.00"),
                "facilities": "table,basti_equipment",
            },
            {
                "name": "Nasya Karma (Nasal Detoxification)",
                "category": "pradhana_karma",
                "dosha_target": "Urdhwajatrugata Prana & Kapha-Vata",
                "indications": "Chronic Sinusitis, Migraine, Cervical Spondylosis, Facial Paralysis, Premature Hair Greying, Stress",
                "description": "Nasal administration of medicated herbal oils and extracts targeting head, neck, sensory organs, and nervous system purification.",
                "duration": 45,
                "price": Decimal("1100.00"),
                "facilities": "table,nasya_dropper,facial_steam",
            },
            {
                "name": "Raktamokshana (Leech / Bloodletting Therapy)",
                "category": "pradhana_karma",
                "dosha_target": "Rakta Dhatu & Pitta Vitiation",
                "indications": "Varicose Veins, Non-Healing Ulcers, Severe Acne, Eczema, Localized Pigmentation, Gouty Arthritis",
                "description": "Classical blood-purification treatment using Jalauka (medicinal leeches) or Siravyadha to relieve localized toxic hyperemia and deep blood morbidity.",
                "duration": 60,
                "price": Decimal("2500.00"),
                "facilities": "table,leech_tank,dressing_kit",
            },

            # ---------------------------------------------------------
            # 2. POORVA KARMA (PREPARATORY THERAPIES)
            # ---------------------------------------------------------
            {
                "name": "Deepana & Pachana Protocol",
                "category": "poorva_karma",
                "dosha_target": "Agni Stimulating & Ama Digestion",
                "indications": "Sluggish metabolism, Loss of appetite, Preparation for Snehapana, Toxin accumulation",
                "description": "Internal administration of appetizing and carminative herbs to kindle digestive fire (Jatharagni) and digest circulating Ama before oleation.",
                "duration": 30,
                "price": Decimal("800.00"),
                "facilities": "consultation_desk",
            },
            {
                "name": "Snehapana (Internal Oleation)",
                "category": "poorva_karma",
                "dosha_target": "Dosha Liquefaction into Gut",
                "indications": "Preparatory for Vamana & Virechana, Chronic Dryness, Degenerative conditions",
                "description": "Progressive dosage ingestion of medicated cow ghee (e.g. Guggulu Tikta Ghrita) to saturate bodily cells and loosen morbid doshas from tissues.",
                "duration": 45,
                "price": Decimal("1500.00"),
                "facilities": "measuring_kit,ghee_warmer",
            },
            {
                "name": "Sarvanga Abhyanga (Full Body Herbal Oil Massage)",
                "category": "poorva_karma",
                "dosha_target": "Vata Pacification & Lymphatic Flow",
                "indications": "Muscle stiffness, Physical exhaustion, Insomnia, Neuropathy, Vata imbalance",
                "description": "Full-body synchronized warm medicated oil massage along energy channels (Nadipath) to soften tissues and stimulate peripheral circulation.",
                "duration": 60,
                "price": Decimal("1400.00"),
                "facilities": "table,oil,droni",
            },
            {
                "name": "Bashpa Sweda (Herbal Steam Bath)",
                "category": "poorva_karma",
                "dosha_target": "Srotas Dilatation & Toxin Mobilization",
                "indications": "Stiff joints, Heaviness in body, Obesity, Post-Abhyanga sweat therapy",
                "description": "Enclosing the patient in an aromatic herbal steam chamber to induce profuse sweating, liquefying metabolic impurities toward the digestive tract.",
                "duration": 30,
                "price": Decimal("800.00"),
                "facilities": "steam_chamber,herbal_boiler",
            },
            {
                "name": "Nadi Sweda (Localized Steam Therapy)",
                "category": "poorva_karma",
                "dosha_target": "Localized Vata-Kapha Pain",
                "indications": "Frozen Shoulder, Cervical stiffness, Knee pain, Sciatica trigger points",
                "description": "Direct application of pressurized herbal medicated steam via a specialized nozzle to concentrated areas of acute stiffness and pain.",
                "duration": 30,
                "price": Decimal("700.00"),
                "facilities": "nadi_sweda_apparatus,table",
            },
            {
                "name": "Patra Pinda Sweda (Elakizhi)",
                "category": "poorva_karma",
                "dosha_target": "Vata-Kapha Inflammation & Swelling",
                "indications": "Cervical Spondylosis, Osteoarthritis, Sports Injuries, Chronic Muscle Spasms, Backache",
                "description": "Application of heated boluses containing medicinal herbs, leaves, coconut, and lemon fried in herbal oils to relieve deep musculoskeletal inflammation.",
                "duration": 60,
                "price": Decimal("1600.00"),
                "facilities": "table,kizhi_pan,oil",
            },
            {
                "name": "Shashtika Shali Pinda Sweda (Navara Kizhi)",
                "category": "poorva_karma",
                "dosha_target": "Vata Pacification & Dhatu Rejuvenation",
                "indications": "Muscular Dystrophy, Post-Stroke Paralysis, Emaciation, Joint Degeneration, Anti-aging",
                "description": "Nourishing fomentation using medicated Navara rice cooked in Bala herb decoction and cow milk, tied in linen boluses for deep tissue regeneration.",
                "duration": 75,
                "price": Decimal("2200.00"),
                "facilities": "table,navara_rice_kit,milk",
            },

            # ---------------------------------------------------------
            # 3. PASCHAT KARMA (POST-TREATMENT & RECOVERY)
            # ---------------------------------------------------------
            {
                "name": "Samsarjana Krama Diet Consultation",
                "category": "paschat_karma",
                "dosha_target": "Agni Restoration & Gut Protection",
                "indications": "Post-Vamana and Post-Virechana digestive revival, convalescent diet",
                "description": "Graduated dietary regimen transitioning from thin gruel (Peya) to thick soup (Vilepi) and legume broth (Yusha) to restore fragile post-purification digestion.",
                "duration": 30,
                "price": Decimal("600.00"),
                "facilities": "consultation_desk",
            },
            {
                "name": "Dhumapana & Kavala-Gandusha",
                "category": "paschat_karma",
                "dosha_target": "Head & Throat Clearance",
                "indications": "Post-Nasya and Post-Vamana airway clearance, halitosis, vocal clarity",
                "description": "Inhalation of medicated herbal smoke followed by therapeutic warm oil holding (Gandusha) and gargling (Kavala) for head lightness.",
                "duration": 25,
                "price": Decimal("500.00"),
                "facilities": "dhumapana_pipe,herbal_stick",
            },
            {
                "name": "Rasayana Chikitsa & Ojas Therapy",
                "category": "paschat_karma",
                "dosha_target": "Sapta Dhatu Rejuvenation & Immunity",
                "indications": "Post-Panchakarma rejuvenation, Longevity, Chronic fatigue, Vitality recovery",
                "description": "Specialized herbal formulation regimen (e.g. Chyawanprash, Brahma Rasayana) prescribed following detoxification to rebuild pristine tissue and Ojas.",
                "duration": 40,
                "price": Decimal("1800.00"),
                "facilities": "consultation_desk",
            },

            # ---------------------------------------------------------
            # 4. UPAKARMA (SPECIALIZED CLASSICAL AYURVEDIC THERAPIES)
            # ---------------------------------------------------------
            {
                "name": "Shirodhara (Medicated Oil Stream)",
                "category": "upakarma",
                "dosha_target": "Pitta-Vata & Manovaha Srotas",
                "indications": "Insomnia, Anxiety, Hypertension, Chronic Stress, Depression, Headaches",
                "description": "Continuous, rhythmic pouring of warm medicated herbal oil (or kashaya) on the forehead (Ajna chakra) inducing deep parasympathetic relaxation.",
                "duration": 45,
                "price": Decimal("1800.00"),
                "facilities": "shirodhara_stand,table,oil",
            },
            {
                "name": "Takradhara (Medicated Buttermilk Stream)",
                "category": "upakarma",
                "dosha_target": "Pitta Pacification & Scalp Cooling",
                "indications": "Psoriasis, Alopecia, Premature Greying, Chronic Insomnia, Mental exhaustion",
                "description": "Gentle, continuous flow of medicated herbal buttermilk poured onto the forehead, highly effective for scalp and psychological disorders.",
                "duration": 45,
                "price": Decimal("1700.00"),
                "facilities": "shirodhara_stand,table,buttermilk",
            },
            {
                "name": "Kati Basti (Lumbosacral Oil Reservoir)",
                "category": "upakarma",
                "dosha_target": "Apana Vata & Asthi Dhatu",
                "indications": "Lumbar Spondylosis, Disc Bulge, Sciatica, Chronic Lower Back Pain, Sacroiliitis",
                "description": "Retaining warm medicated herbal oil within a specially shaped ring of black gram dough placed over the lumbosacral spine for deep disc regeneration.",
                "duration": 45,
                "price": Decimal("1300.00"),
                "facilities": "table,dough_ring,warm_oil",
            },
            {
                "name": "Janu Basti (Knee Joint Oil Reservoir)",
                "category": "upakarma",
                "dosha_target": "Sandhigata Vata (Knee Joint)",
                "indications": "Knee Osteoarthritis, Meniscus injury, Crepitus, Stiffness, Difficulty walking",
                "description": "Warm medicated herbal oil retained in circular reservoirs over the knee joints to nourish the synovial fluid and reduce friction.",
                "duration": 45,
                "price": Decimal("1300.00"),
                "facilities": "table,dough_ring,warm_oil",
            },
            {
                "name": "Greeva Basti (Cervical Spine Reservoir)",
                "category": "upakarma",
                "dosha_target": "Cervical Vata & Spondylosis",
                "indications": "Cervical Spondylosis, Stiff Neck, Upper Back Pain, Brachial Neuralgia, Whiplash",
                "description": "Warm medicated oil reservoir held over the back of the neck and cervical vertebrae to alleviate nerve compression and muscle rigidity.",
                "duration": 45,
                "price": Decimal("1300.00"),
                "facilities": "table,dough_ring,warm_oil",
            },
            {
                "name": "Netra Tarpana (Medicated Eye Pool)",
                "category": "upakarma",
                "dosha_target": "Alochaka Pitta & Vata",
                "indications": "Computer Vision Syndrome, Dry Eyes, Blurred Vision, Burning Sensation, Myopia",
                "description": "Pooling warm liquid medicated ghee (Triphala Ghrita) around the open eyes within a flour dough rim, revitalizing optic tissues.",
                "duration": 40,
                "price": Decimal("1200.00"),
                "facilities": "eye_cups,triphala_ghrita,table",
            },
            {
                "name": "Pizhichil (Sarvangadhara - Royal Oil Bath)",
                "category": "upakarma",
                "dosha_target": "Severe Vata Disorders & Neuro-recovery",
                "indications": "Hemiplegia, Parkinsonism, Ankylosing Spondylitis, Neuropathy, Extreme Fatigue",
                "description": "Continuous streams of lukewarm medicated herbal oil rhythmically squeezed from linen cloths over the entire body while being simultaneously massaged.",
                "duration": 75,
                "price": Decimal("3000.00"),
                "facilities": "droni_table,warm_oil_kettle,linen",
            },
            {
                "name": "Udvartana (Herbal Powder Scrub)",
                "category": "upakarma",
                "dosha_target": "Meda Dhatu & Kapha Reduction",
                "indications": "Obesity, Cellulite, Poor Circulation, Skin roughness, Sluggish metabolism",
                "description": "Deep, upward rhythmic massage using dry medicated herbal powders to break down subcutaneous fat, exfoliate skin, and clear lymphatic channels.",
                "duration": 60,
                "price": Decimal("1300.00"),
                "facilities": "table,herbal_powder",
            },
            {
                "name": "Shirovasti (Retention Cap Therapy)",
                "category": "upakarma",
                "dosha_target": "Severe Vata-Pitta Brain & Nerve Disorders",
                "indications": "Facial Palsy, Trigeminal Neuralgia, Severe Migraine, Optic Atrophy, Insomnia",
                "description": "Medicated warm herbal oil retained on the scalp inside an elongated cylindrical leather cap tied around the head for acute neurological relief.",
                "duration": 60,
                "price": Decimal("2600.00"),
                "facilities": "leather_cap,table,oil",
            },
        ]

        print("Seeding full classical Panchakarma suite...")
        for item in panchakarma_suite:
            existing = db.query(Therapy).filter(Therapy.name == item["name"]).first()
            if existing:
                existing.category = item["category"]
                existing.dosha_target = item["dosha_target"]
                existing.indications = item["indications"]
                existing.description = item["description"]
                existing.default_duration_minutes = item["duration"]
                existing.suggested_price = item["price"]
                existing.required_facilities = item["facilities"]
            else:
                th = Therapy(
                    name=item["name"],
                    category=item["category"],
                    dosha_target=item["dosha_target"],
                    indications=item["indications"],
                    description=item["description"],
                    default_duration_minutes=item["duration"],
                    suggested_price=item["price"],
                    required_facilities=item["facilities"],
                    is_active=True,
                )
                db.add(th)

        # Also update old simple therapies if they exist
        old_updates = {
            "Abhyanga": ("Sarvanga Abhyanga (Full Body Herbal Oil Massage)", "poorva_karma", "Vata Pacification", "Muscle stiffness, Fatigue"),
            "Shirodhara": ("Shirodhara (Medicated Oil Stream)", "upakarma", "Pitta-Vata & Manovaha Srotas", "Insomnia, Anxiety, Stress"),
            "Nasya": ("Nasya Karma (Nasal Detoxification)", "pradhana_karma", "Urdhwajatrugata Prana", "Sinusitis, Migraine, Cervical Spondylosis"),
            "Basti": ("Niruha / Kashaya Basti (Medicated Decoction Enema)", "pradhana_karma", "Vata Dosha (Ardha Chikitsa)", "Arthritis, Sciatica, Constipation"),
            "Udvartana": ("Udvartana (Herbal Powder Scrub)", "upakarma", "Meda Dhatu & Kapha Reduction", "Obesity, Sluggish circulation"),
        }
        for old_name, (new_name, cat, dosha, ind) in old_updates.items():
            old = db.query(Therapy).filter(Therapy.name == old_name).first()
            if old:
                old.category = cat
                old.dosha_target = dosha
                old.indications = ind

        db.commit()

        # Authorize therapists for all therapies
        therapists = db.query(Staff).filter(Staff.is_therapist == True).all()
        all_therapies = db.query(Therapy).all()
        print(f"Authorizing {len(therapists)} therapists for {len(all_therapies)} Panchakarma therapies...")
        for th_staff in therapists:
            for therapy in all_therapies:
                existing_auth = db.query(TherapistTherapy).filter(
                    TherapistTherapy.staff_id == th_staff.id,
                    TherapistTherapy.therapy_id == therapy.id
                ).first()
                if not existing_auth:
                    db.add(TherapistTherapy(staff_id=th_staff.id, therapy_id=therapy.id))
        
        # Ensure rooms have facilities
        rooms = db.query(Room).all()
        for r in rooms:
            if r.facilities:
                # Add panchakarma equipment to general facilities
                facilities_set = set([f.strip() for f in r.facilities.split(",") if f.strip()])
                facilities_set.update(["table", "oil", "dough_ring", "warm_oil", "steam_chamber", "basti_equipment", "shirodhara_stand", "herbal_boiler", "emesis_bowl"])
                r.facilities = ",".join(facilities_set)

        db.commit()
        print("Panchakarma migration and seeding successfully completed!")
    finally:
        db.close()

if __name__ == "__main__":
    run()
