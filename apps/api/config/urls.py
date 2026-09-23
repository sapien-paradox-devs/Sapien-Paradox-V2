from django.conf import settings
from django.contrib import admin
from django.urls import path

from core.api import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]

# Development only: with no R2 configured, video URLs point at local /media/ (D77's
# fallback, mandate 6). Never in production, where storage is R2 and signed.
if settings.DEBUG and not settings.AWS_STORAGE_BUCKET_NAME:
    from django.conf.urls.static import static

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
