"""
listings/management/commands/seed_demo.py
Django concept: Management command — run with:
  python manage.py seed_demo
Loads demo data (brands, models, variants, listings) into the Django SQLite DB.
"""
from django.core.management.base import BaseCommand
from listings.models import Brand, CarModel, Variant, Listing


SEED_DATA = [
    {
        'brand': {'name': 'Maruti Suzuki', 'slug': 'maruti-suzuki'},
        'models': [
            {
                'name': 'Swift', 'slug': 'swift', 'body_type': 'Hatchback',
                'fuel_type': 'Petrol,CNG', 'seating': 5,
                'variants': [
                    {'name': 'LXI',  'price': 549900,  'transmission': 'Manual',    'mileage_kmpl': 23.2, 'engine_cc': 1197},
                    {'name': 'VXI',  'price': 649900,  'transmission': 'Manual',    'mileage_kmpl': 23.2, 'engine_cc': 1197},
                    {'name': 'ZXI',  'price': 789900,  'transmission': 'Manual',    'mileage_kmpl': 23.2, 'engine_cc': 1197},
                    {'name': 'ZXI+', 'price': 849900,  'transmission': 'Automatic', 'mileage_kmpl': 22.6, 'engine_cc': 1197},
                ]
            },
            {
                'name': 'Brezza', 'slug': 'brezza', 'body_type': 'SUV',
                'fuel_type': 'Petrol,CNG', 'seating': 5,
                'variants': [
                    {'name': 'LXI',  'price': 799900,  'transmission': 'Manual',    'mileage_kmpl': 17.4, 'engine_cc': 1462},
                    {'name': 'ZXI',  'price': 1079900, 'transmission': 'Automatic', 'mileage_kmpl': 19.8, 'engine_cc': 1462},
                ]
            },
        ]
    },
    {
        'brand': {'name': 'Hyundai', 'slug': 'hyundai'},
        'models': [
            {
                'name': 'Creta', 'slug': 'creta', 'body_type': 'SUV',
                'fuel_type': 'Petrol,Diesel', 'seating': 5,
                'variants': [
                    {'name': 'E',   'price': 1000000, 'transmission': 'Manual',    'mileage_kmpl': 17.0, 'engine_cc': 1497},
                    {'name': 'SX',  'price': 1699900, 'transmission': 'Automatic', 'mileage_kmpl': 18.3, 'engine_cc': 1497},
                ]
            },
            {
                'name': 'i20', 'slug': 'i20', 'body_type': 'Hatchback',
                'fuel_type': 'Petrol,Diesel', 'seating': 5,
                'variants': [
                    {'name': 'Era',  'price': 699900,  'transmission': 'Manual',    'mileage_kmpl': 20.35, 'engine_cc': 1197},
                    {'name': 'Asta', 'price': 1049900, 'transmission': 'Automatic', 'mileage_kmpl': 19.65, 'engine_cc': 1197},
                ]
            },
        ]
    },
    {
        'brand': {'name': 'Tata Motors', 'slug': 'tata-motors'},
        'models': [
            {
                'name': 'Nexon', 'slug': 'nexon', 'body_type': 'SUV',
                'fuel_type': 'Petrol,Diesel,Electric', 'seating': 5,
                'variants': [
                    {'name': 'Smart',    'price': 799900,  'transmission': 'Manual',    'mileage_kmpl': 17.38, 'engine_cc': 1497},
                    {'name': 'EV Max',   'price': 1899900, 'transmission': 'Automatic', 'mileage_kmpl': None,  'engine_cc': None},
                ]
            },
        ]
    },
]

# Listings: (brand_slug, model_slug, variant_name, year, city, price, listing_type)
LISTING_DATA = [
    ('maruti-suzuki', 'swift',  'LXI',   2024, 'Mumbai',    549900,  'new'),
    ('maruti-suzuki', 'swift',  'ZXI+',  2024, 'Delhi',     849900,  'new'),
    ('maruti-suzuki', 'swift',  'VXI',   2021, 'Mumbai',    480000,  'used'),
    ('maruti-suzuki', 'brezza', 'ZXI',   2024, 'Bangalore', 1079900, 'new'),
    ('hyundai',       'creta',  'SX',    2024, 'Chennai',   1699900, 'new'),
    ('hyundai',       'creta',  'E',     2020, 'Mumbai',    1050000, 'used'),
    ('hyundai',       'i20',    'Era',   2024, 'Hyderabad', 699900,  'new'),
    ('hyundai',       'i20',    'Asta',  2022, 'Delhi',     810000,  'used'),
    ('tata-motors',   'nexon',  'Smart', 2024, 'Mumbai',    799900,  'new'),
    ('tata-motors',   'nexon',  'Smart', 2021, 'Bangalore', 870000,  'used'),
]


class Command(BaseCommand):
    help = 'Seed AutoBid Django database with demo listings data'

    def handle(self, *args, **options):
        self.stdout.write('[seed_demo] Starting Django seed...')

        # Create brands, models, variants
        variant_map = {}  # (brand_slug, model_slug, variant_name) -> Variant
        for entry in SEED_DATA:
            brand, _ = Brand.objects.get_or_create(
                slug=entry['brand']['slug'],
                defaults={'name': entry['brand']['name']}
            )
            for m in entry['models']:
                car_model, _ = CarModel.objects.get_or_create(
                    slug=m['slug'], brand=brand,
                    defaults={
                        'name':      m['name'],
                        'body_type': m['body_type'],
                        'fuel_type': m['fuel_type'],
                        'seating':   m['seating'],
                    }
                )
                for v in m['variants']:
                    variant, _ = Variant.objects.get_or_create(
                        car_model=car_model, name=v['name'],
                        defaults={
                            'price':        v['price'],
                            'transmission': v['transmission'],
                            'mileage_kmpl': v.get('mileage_kmpl'),
                            'engine_cc':    v.get('engine_cc'),
                        }
                    )
                    variant_map[(entry['brand']['slug'], m['slug'], v['name'])] = variant

        self.stdout.write('[seed_demo] Brands, models, variants done.')

        # Create listings
        for brand_slug, model_slug, variant_name, year, city, price, ltype in LISTING_DATA:
            key     = (brand_slug, model_slug, variant_name)
            variant = variant_map.get(key)
            if not variant:
                self.stdout.write(f'  [skip] variant not found: {key}')
                continue
            Listing.objects.get_or_create(
                variant=variant, year=year, city=city, listing_type=ltype,
                defaults={'listing_price': price, 'status': 'available'}
            )

        self.stdout.write(self.style.SUCCESS(
            '[seed_demo] DONE! {} listings, {} brands, {} variants.'.format(
                Listing.objects.count(), Brand.objects.count(), Variant.objects.count()
            )
        ))
        self.stdout.write('[seed_demo] Create a superuser: python manage.py createsuperuser')
