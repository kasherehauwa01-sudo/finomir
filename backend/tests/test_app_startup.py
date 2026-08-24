def test_application_imports_with_all_routes_registered():
    from app.main import app
    from app.api.routes import router
    from app.api.notifications import router as notification_router

    paths = {route.path for route in router.routes}
    assert app is not None
    assert "/health" in paths
    assert "/expenses" in paths
    assert "/expenses/bulk-tags" in paths
    notification_paths = {route.path for route in notification_router.routes}
    assert "/settings/smtp" in notification_paths
    assert "/notifications" in notification_paths
