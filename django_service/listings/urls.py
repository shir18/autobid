"""
listings/urls.py
Django concept: DefaultRouter auto-generates all CRUD routes + custom @action URLs.
"""
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from . import views

router = DefaultRouter()
router.register(r'brands',   views.BrandViewSet,    basename='brand')
router.register(r'models',   views.CarModelViewSet, basename='carmodel')
router.register(r'variants', views.VariantViewSet,  basename='variant')
router.register(r'listings', views.ListingViewSet,  basename='listing')
router.register(r'orders',   views.OrderViewSet,    basename='order')

urlpatterns = [
    path('', include(router.urls)),
]
