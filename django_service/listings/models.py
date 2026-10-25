"""
listings/models.py
Django concept: Models with proper ForeignKeys, related_name, __str__, Meta.
Mirrors the core MySQL entities for the Django side service.
"""
from django.db import models


class Brand(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class CarModel(models.Model):
    brand    = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name='car_models')
    name     = models.CharField(max_length=100)
    slug     = models.SlugField()
    body_type = models.CharField(max_length=50)
    fuel_type = models.CharField(max_length=100)
    seating  = models.IntegerField(default=5)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.brand.name} {self.name}"


class Variant(models.Model):
    car_model    = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name='variants')
    name         = models.CharField(max_length=150)
    price        = models.DecimalField(max_digits=12, decimal_places=2)
    transmission = models.CharField(max_length=20)
    mileage_kmpl = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    engine_cc    = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.car_model} — {self.name}"


class Listing(models.Model):
    """
    Car listing (new or used). The fair-price endpoint computes
    the median price for same model/variant/year/city.
    """
    TYPE_CHOICES = [('new', 'New'), ('used', 'Used')]

    variant       = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name='listings')
    listing_type  = models.CharField(max_length=4, choices=TYPE_CHOICES, default='new')
    year          = models.IntegerField()
    km_driven     = models.IntegerField(default=0)
    owner_count   = models.IntegerField(default=0)
    city          = models.CharField(max_length=100)
    listing_price = models.DecimalField(max_digits=12, decimal_places=2)
    status        = models.CharField(max_length=20, default='available')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.variant} ({self.city}) — ₹{self.listing_price}"


class Order(models.Model):
    STATUS_CHOICES = [
        ('confirmed', 'Confirmed'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    listing    = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='orders')
    buyer_ref  = models.IntegerField(help_text='User ID from the MySQL users table')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.id} — {self.listing} ({self.status})"
