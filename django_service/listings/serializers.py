"""
listings/serializers.py
Django concept: DRF ModelSerializers for each model.
"""
from rest_framework import serializers
from .models import Brand, CarModel, Variant, Listing, Order


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Brand
        fields = '__all__'


class CarModelSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.name', read_only=True)

    class Meta:
        model  = CarModel
        fields = '__all__'


class VariantSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source='car_model.name', read_only=True)
    brand_name = serializers.CharField(source='car_model.brand.name', read_only=True)

    class Meta:
        model  = Variant
        fields = '__all__'


class ListingSerializer(serializers.ModelSerializer):
    variant_name = serializers.CharField(source='variant.name', read_only=True)
    model_name   = serializers.CharField(source='variant.car_model.name', read_only=True)
    brand_name   = serializers.CharField(source='variant.car_model.brand.name', read_only=True)
    body_type    = serializers.CharField(source='variant.car_model.body_type', read_only=True)
    fuel_type    = serializers.CharField(source='variant.car_model.fuel_type', read_only=True)

    class Meta:
        model  = Listing
        fields = '__all__'


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Order
        fields = '__all__'
