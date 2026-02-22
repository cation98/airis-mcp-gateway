FROM ghcr.io/oraios/serena:latest

# ============================================================
# Patched Serena image for .NET 8.0 C# projects
# ghcr.io/cation98/serena:patched
# ============================================================
# Fixes:
#   1. libicu — required by Roslyn Language Server for globalization
#   2. .NET 10.0-rc2 runtime — required by bundled Roslyn LS binary (net10.0 TFM)
#   3. .NET 8.0 SDK — required for MSBuild project loading of .NET 8.0 projects
#   4. Pre-download Roslyn LS — avoids race condition with runtimeconfig patch
#   5. Source patch — --version → --channel for dotnet-install.sh compatibility
# ============================================================

# --- 1. System dependencies ---
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends libicu-dev curl unzip && \
    rm -rf /var/lib/apt/lists/*

# --- 2. Pre-install .NET 10.0-rc2 runtime at Serena's expected path ---
ENV SERENA_DOTNET_DIR=/workspaces/serena/config/language_servers/static/CSharpLanguageServer/dotnet-runtime-10.0
RUN mkdir -p ${SERENA_DOTNET_DIR} && \
    curl -sSL https://dot.net/v1/dotnet-install.sh -o ${SERENA_DOTNET_DIR}/dotnet-install.sh && \
    chmod +x ${SERENA_DOTNET_DIR}/dotnet-install.sh && \
    bash ${SERENA_DOTNET_DIR}/dotnet-install.sh \
        --channel 10.0 \
        --quality preview \
        --install-dir ${SERENA_DOTNET_DIR} \
        --runtime dotnet \
        --no-path

# --- 3. Install .NET 8.0 SDK globally (for MSBuild project loading) ---
RUN bash ${SERENA_DOTNET_DIR}/dotnet-install.sh \
        --channel 8.0 \
        --install-dir /usr/local/share/dotnet \
        --no-path && \
    ln -sf /usr/local/share/dotnet/dotnet /usr/local/bin/dotnet

# --- 4. Pre-download and patch Roslyn Language Server (linux-arm64) ---
ENV ROSLYN_VERSION=5.5.0-2.26078.4
ENV ROSLYN_PKG=roslyn-language-server.linux-arm64
ENV ROSLYN_BASE=/workspaces/serena/config/language_servers/static/CSharpLanguageServer
ENV ROSLYN_DIR=${ROSLYN_BASE}/${ROSLYN_PKG}.${ROSLYN_VERSION}

RUN mkdir -p /tmp/roslyn-download && \
    curl -sSL -o /tmp/roslyn-download/roslyn.nupkg \
        "https://www.nuget.org/api/v2/package/${ROSLYN_PKG}/${ROSLYN_VERSION}" && \
    mkdir -p ${ROSLYN_DIR} && \
    unzip -q /tmp/roslyn-download/roslyn.nupkg "tools/net10.0/linux-arm64/*" -d /tmp/roslyn-download && \
    cp -r /tmp/roslyn-download/tools/net10.0/linux-arm64/* ${ROSLYN_DIR}/ && \
    rm -rf /tmp/roslyn-download

# Patch runtimeconfig.json: set version to match installed rc runtime
# (pre-release runtime cannot satisfy release version requirement regardless of rollForward policy)
RUN INSTALLED_VERSION=$(ls ${SERENA_DOTNET_DIR}/shared/Microsoft.NETCore.App/) && \
    sed -i "s/\"version\": \"10.0.0\"/\"version\": \"${INSTALLED_VERSION}\"/" \
        ${ROSLYN_DIR}/Microsoft.CodeAnalysis.LanguageServer.runtimeconfig.json && \
    echo "Patched runtimeconfig to version: ${INSTALLED_VERSION}"

# --- 5. Patch source: --version → --channel for dotnet-install.sh ---
RUN sed -i 's/"--version",/"--channel",/' \
    /workspaces/serena/src/solidlsp/language_servers/csharp_language_server.py

# Preserve original entrypoint
ENTRYPOINT ["/bin/bash", "-c", "source .venv/bin/activate && $0 $@"]
