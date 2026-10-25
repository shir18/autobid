"""
listings/admin.py
Django concept: All models registered in Django admin for browser-based management.
"""
from django.contrib import admin
from .models import Brand, CarModel, Variant, Listing, Order


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display  = ('name', 'slug')
    search_fields = ('name',)


@admin.register(CarModel)
class CarModelAdmin(admin.ModelAdmin):
    list_display  = ('name', 'brand', 'body_type', 'fuel_type', 'seating')
    list_filter   = ('brand', 'body_type', 'fuel_type')
    search_fields = ('name',)


@admin.register(Variant)
class VariantAdmin(admin.ModelAdmin):
    list_display  = ('name', 'car_model', 'price', 'transmission', 'mileage_kmpl')
    list_filter   = ('transmission',)
    search_fields = ('name', 'car_model__name')


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display  = ('variant', 'listing_type', 'year', 'city', 'listing_price', 'status')
    list_filter   = ('listing_type', 'city', 'status', 'year')
    search_fields = ('variant__name', 'city')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display  = ('id', 'listing', 'buyer_ref', 'status', 'created_at')
    list_filter   = ('status',)
