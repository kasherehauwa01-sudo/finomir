def test_application_imports_with_all_routes_registered():
    from app.main import app
    from app.api.routes import router

    paths = {route.path for route in router.routes}
    assert app is not None
    assert "/health" in paths
    assert "/expenses" in paths
    assert "/expenses/bulk-tags" in paths
