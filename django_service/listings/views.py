"""
listings/views.py
Django concepts:
- ModelViewSets with DefaultRouter
- Custom @action endpoints: /api/listings/{id}/fair-price/ and /api/orders/counts_by_status/
- IsAuthenticatedOrReadOnly permission on public data
- TokenAuthentication + SessionAuthentication (set in settings.py)
"""
import statistics
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from .models import Brand, CarModel, Variant, Listing, Order
from .serializers import (
    BrandSerializer, CarModelSerializer, VariantSerializer,
    ListingSerializer, OrderSerializer
)


class BrandViewSet(viewsets.ModelViewSet):
    queryset           = Brand.objects.all()
    serializer_class   = BrandSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class CarModelViewSet(viewsets.ModelViewSet):
    queryset           = CarModel.objects.select_related('brand').all()
    serializer_class   = CarModelSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        brand = self.request.query_params.get('brand')
        if brand:
            qs = qs.filter(brand__slug=brand)
        return qs


class VariantViewSet(viewsets.ModelViewSet):
    queryset           = Variant.objects.select_related('car_model__brand').all()
    serializer_class   = VariantSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class ListingViewSet(viewsets.ModelViewSet):
    """
    Listing ViewSet.
    Custom @action: /api/listings/{id}/fair-price/
    Computes the median price of listings with the same model, year, and city,
    then labels the listing as: 'Great deal', 'Fair', or 'Above market'.
    """
    queryset           = Listing.objects.select_related('variant__car_model__brand').all()
    serializer_class   = ListingSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        listing_type = self.request.query_params.get('type')
        city         = self.request.query_params.get('city')
        if listing_type:
            qs = qs.filter(listing_type=listing_type)
        if city:
            qs = qs.filter(city=city)
        return qs

    @action(detail=True, methods=['get'], url_path='fair-price')
    def fair_price(self, request, pk=None):
        """
        Django concept: Custom @action endpoint.
        Returns a fair-price label by comparing this listing's price to
        the median price of similar listings (same model + year + city).
        """
        try:
            listing = self.get_object()
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found'}, status=status.HTTP_404_NOT_FOUND)

        # Find comparable listings: same model, same year, same city
        comparables = Listing.objects.filter(
            variant__car_model=listing.variant.car_model,
            year=listing.year,
            city=listing.city,
            status='available'
        ).values_list('listing_price', flat=True)

        prices = [float(p) for p in comparables if p is not None]

        if len(prices) < 2:
            # Not enough data — fall back to comparing to variant base price
            base_price = float(listing.variant.price)
            prices = [base_price]

        median_price = statistics.median(prices)
        own_price    = float(listing.listing_price)

        ratio = own_price / median_price if median_price > 0 else 1.0

        if ratio < 0.95:
            label = 'Great deal'
            pct   = round((1 - ratio) * 100, 1)
            detail = f'{pct}% below market median'
        elif ratio <= 1.05:
            label  = 'Fair'
            detail = 'Priced near market median'
        else:
            label = 'Above market'
            pct   = round((ratio - 1) * 100, 1)
            detail = f'{pct}% above market median'

        return Response({
            'listing_id':    listing.id,
            'listing_price': own_price,
            'median_price':  round(median_price, 2),
            'label':         label,
            'detail':        detail,
            'comparables':   len(prices)
        })


class OrderViewSet(viewsets.ModelViewSet):
    """
    Order ViewSet.
    Custom @action: /api/orders/counts_by_status/
    """
    queryset           = Order.objects.select_related('listing').all()
    serializer_class   = OrderSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=False, methods=['get'], url_path='counts_by_status')
    def counts_by_status(self, request):
        """
        Django concept: Custom @action that returns order counts grouped by status.
        """
        counts = Order.objects.values('status').annotate(count=Count('id')).order_by('status')
        return Response(list(counts))
