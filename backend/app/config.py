from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    db_name: str = "sabha_app"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    first_admin_name: str = "Administrator"
    first_admin_email: str = "admin@sabha.app"
    first_admin_password: str = "ChangeMe123!"

    # --- Google Sign-In ---
    # OAuth 2.0 Web-application Client ID from Google Cloud Console.
    google_client_id: str = ""
    # This Google account is always allowed and is granted the admin role.
    primary_admin_email: str = "vijayrathod1@gmail.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
