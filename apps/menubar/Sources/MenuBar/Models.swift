import Foundation

struct MCPServer: Codable {
    let id: Int
    let name: String
    let enabled: Bool
    let command: String?
    let args: [String]?
    let env: [String: String]?
    let description: String?
    let category: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case enabled
        case command
        case args
        case env
        case description
        case category
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
