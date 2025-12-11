import Foundation

class GatewayAPI {
    let baseURL = "http://localhost:9400/api/v1"

    func fetchServers() async throws -> [MCPServer] {
        guard let url = URL(string: "\(baseURL)/mcp/servers/") else {
            throw APIError.invalidURL
        }

        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        let decoder = JSONDecoder()
        return try decoder.decode([MCPServer].self, from: data)
    }

    func toggleServer(id: Int, enabled: Bool) async throws {
        guard let url = URL(string: "\(baseURL)/mcp/servers/\(id)/toggle") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["enabled": enabled]
        request.httpBody = try JSONEncoder().encode(body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
    }
}

enum APIError: Error {
    case invalidURL
    case httpError(Int)
}
